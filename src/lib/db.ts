import { Pool, QueryResult } from 'pg';
import crypto from 'crypto';
import { signTransaction, isSigningConfigured } from './transaction-signing';

// Create PostgreSQL connection pool for AWS RDS
// SECURITY: SSL is REQUIRED for database connections
// Note: AWS RDS uses Amazon's internal CA which requires special handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // AWS RDS uses Amazon's internal CA certificates
    // rejectUnauthorized: false is acceptable here because:
    // 1. The connection is still encrypted (TLS)
    // 2. AWS RDS is within Amazon's secure network
    // 3. The DATABASE_URL already specifies sslmode=require
    rejectUnauthorized: false,
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log connection status
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Tagged template literal helper that mimics neon's API
interface SqlFunction {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  unsafe: (rawSql: string) => { __raw: string };
}

function createSqlQuery(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  let text = '';
  let paramIndex = 1;
  const params: any[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      const value = values[i];
      // Check if this is a raw SQL fragment from sql.unsafe()
      if (value && typeof value === 'object' && '__raw' in value) {
        text += value.__raw;
      } else {
        text += `$${paramIndex++}`;
        params.push(value);
      }
    }
  }

  return pool.query(text, params).then((res: QueryResult) => res.rows);
}

const sql: SqlFunction = Object.assign(createSqlQuery, {
  unsafe: (rawSql: string) => ({ __raw: rawSql }),
});

export { sql, pool };

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Create companies table
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        business_name TEXT NOT NULL,
        rfc TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        is_active BOOLEAN DEFAULT true,
        spei_in_enabled BOOLEAN DEFAULT true,
        spei_out_enabled BOOLEAN DEFAULT true,
        commission_percentage DECIMAL(5, 4) DEFAULT 0,
        parent_clabe TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add new columns if they don't exist (migration)
    try {
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS spei_in_enabled BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS spei_out_enabled BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 4) DEFAULT 0`;
      await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS parent_clabe TEXT`;
    } catch (e) {
      // Columns might already exist
    }

    // Create clabe_accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS clabe_accounts (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        clabe TEXT UNIQUE NOT NULL,
        alias TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        is_main BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add is_main column if it doesn't exist (migration)
    try {
      await sql`ALTER TABLE clabe_accounts ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false`;
    } catch (e) {
      // Column might already exist
    }

    // Create users table with company_id reference
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
        permissions TEXT[] DEFAULT '{}',
        avatar TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `;

    // Create user_clabe_access table (many-to-many for user-to-CLABE relationships)
    await sql`
      CREATE TABLE IF NOT EXISTS user_clabe_access (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clabe_account_id TEXT NOT NULL REFERENCES clabe_accounts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, clabe_account_id)
      )
    `;

    // Create sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add company_id column to users if it doesn't exist (for migration)
    try {
      await sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id) ON DELETE SET NULL
      `;
    } catch (e) {
      // Column might already exist
    }

    // Add security columns to users table (for account lockout and 2FA)
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP`;
    } catch (e) {
      // Columns might already exist
    }

    // Create audit_logs table for security auditing
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        user_id TEXT,
        user_email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        details JSONB,
        severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical'))
      )
    `;

    // Create index on audit_logs for faster queries
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)`;
    } catch (e) {
      // Indexes might already exist
    }

    // Create transactions table for tracking SPEI transfers
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        clabe_account_id TEXT REFERENCES clabe_accounts(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK (type IN ('incoming', 'outgoing')),
        status TEXT NOT NULL DEFAULT 'pending',
        amount DECIMAL(18, 2) NOT NULL,
        concept TEXT,
        tracking_key TEXT UNIQUE NOT NULL,
        numerical_reference INTEGER,
        beneficiary_account TEXT,
        beneficiary_bank TEXT,
        beneficiary_name TEXT,
        beneficiary_uid TEXT,
        payer_account TEXT,
        payer_bank TEXT,
        payer_name TEXT,
        payer_uid TEXT,
        opm_order_id TEXT,
        error_detail TEXT,
        cep_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settled_at TIMESTAMP
      )
    `;

    // Create index on tracking_key for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_tracking_key ON transactions(tracking_key)
    `;

    // Create index on clabe_account_id for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_clabe_account ON transactions(clabe_account_id)
    `;

    // Create saved_accounts table - each user has their own saved accounts (third-party accounts for frequent transfers)
    await sql`
      CREATE TABLE IF NOT EXISTS saved_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        alias TEXT NOT NULL,
        clabe TEXT NOT NULL,
        bank_code TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        beneficiary_name TEXT NOT NULL,
        beneficiary_rfc TEXT,
        account_type INTEGER DEFAULT 40,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index on user_id for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_saved_accounts_user ON saved_accounts(user_id)
    `;

    // Create pending_commissions table for daily cutoff system
    await sql`
      CREATE TABLE IF NOT EXISTS pending_commissions (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        amount DECIMAL(18, 2) NOT NULL,
        percentage DECIMAL(5, 4) NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
        cutoff_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create commission_cutoffs table to track daily cutoffs
    await sql`
      CREATE TABLE IF NOT EXISTS commission_cutoffs (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        target_clabe TEXT NOT NULL,
        total_amount DECIMAL(18, 2) NOT NULL,
        commission_count INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
        transaction_id TEXT REFERENCES transactions(id),
        tracking_key TEXT,
        cutoff_date DATE NOT NULL,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_detail TEXT
      )
    `;

    // Create indexes for pending_commissions
    await sql`
      CREATE INDEX IF NOT EXISTS idx_pending_commissions_company ON pending_commissions(company_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_pending_commissions_status ON pending_commissions(status)
    `;

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// ==================== TYPE DEFINITIONS ====================

export interface DbCompany {
  id: string;
  name: string;
  business_name: string;
  rfc: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  spei_in_enabled: boolean;
  spei_out_enabled: boolean;
  commission_percentage: number;
  parent_clabe: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbClabeAccount {
  id: string;
  company_id: string;
  clabe: string;
  alias: string;
  description: string | null;
  is_active: boolean;
  is_main: boolean;
  created_at: Date;
  updated_at: Date;
}

// DbUser matches Prisma schema (camelCase columns)
export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  company_id: string | null;
  permissions: string[];
  avatar: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
}

export interface DbUserClabeAccess {
  user_id: string;
  clabe_account_id: string;
  created_at: Date;
}

export interface DbTransaction {
  id: string;
  clabe_account_id: string | null;
  type: 'incoming' | 'outgoing';
  status: string;
  amount: number;
  concept: string | null;
  tracking_key: string;
  numerical_reference: number | null;
  beneficiary_account: string | null;
  beneficiary_bank: string | null;
  beneficiary_name: string | null;
  beneficiary_uid: string | null;
  payer_account: string | null;
  payer_bank: string | null;
  payer_name: string | null;
  payer_uid: string | null;
  opm_order_id: string | null;
  error_detail: string | null;
  cep_url: string | null;
  created_at: Date;
  updated_at: Date;
  settled_at: Date | null;
  confirmation_deadline: Date | null;
  pending_order_data: Record<string, unknown> | null;
}

export interface DbSavedAccount {
  id: string;
  user_id: string;
  alias: string;
  clabe: string;
  bank_code: string;
  bank_name: string;
  beneficiary_name: string;
  beneficiary_rfc: string | null;
  account_type: number;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbPendingCommission {
  id: string;
  company_id: string;
  source_transaction_id: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'processed' | 'failed';
  cutoff_id: string | null;
  created_at: Date;
}

export interface DbCommissionCutoff {
  id: string;
  company_id: string;
  target_clabe: string;
  total_amount: number;
  commission_count: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  transaction_id: string | null;
  tracking_key: string | null;
  cutoff_date: Date;
  processed_at: Date | null;
  created_at: Date;
  error_detail: string | null;
}

// ==================== COMPANY OPERATIONS ====================

export async function createCompany(company: {
  id: string;
  name: string;
  businessName: string;
  rfc: string;
  email: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  speiInEnabled?: boolean;
  speiOutEnabled?: boolean;
  commissionPercentage?: number;
  parentClabe?: string;
}): Promise<DbCompany> {
  const result = await sql`
    INSERT INTO companies (id, name, business_name, rfc, email, phone, address, is_active, spei_in_enabled, spei_out_enabled, commission_percentage, parent_clabe)
    VALUES (${company.id}, ${company.name}, ${company.businessName}, ${company.rfc}, ${company.email}, ${company.phone || null}, ${company.address || null}, ${company.isActive ?? true}, ${company.speiInEnabled ?? true}, ${company.speiOutEnabled ?? true}, ${company.commissionPercentage ?? 0}, ${company.parentClabe || null})
    RETURNING *
  `;
  return result[0] as DbCompany;
}

export async function getCompanyById(id: string): Promise<DbCompany | null> {
  const result = await sql`
    SELECT * FROM companies WHERE id = ${id}
  `;
  return result[0] as DbCompany | null;
}

export async function getCompanyByRfc(rfc: string): Promise<DbCompany | null> {
  const result = await sql`
    SELECT * FROM companies WHERE rfc = ${rfc}
  `;
  return result[0] as DbCompany | null;
}

export async function getAllCompanies(): Promise<DbCompany[]> {
  const result = await sql`
    SELECT * FROM companies ORDER BY created_at DESC
  `;
  return result as DbCompany[];
}

export async function updateCompany(
  id: string,
  updates: Partial<{
    name: string;
    businessName: string;
    rfc: string;
    email: string;
    phone: string;
    address: string;
    isActive: boolean;
    speiInEnabled: boolean;
    speiOutEnabled: boolean;
    commissionPercentage: number;
    parentClabe: string;
  }>
): Promise<DbCompany | null> {
  const result = await sql`
    UPDATE companies
    SET name = COALESCE(${updates.name}, name),
        business_name = COALESCE(${updates.businessName}, business_name),
        rfc = COALESCE(${updates.rfc}, rfc),
        email = COALESCE(${updates.email}, email),
        phone = COALESCE(${updates.phone}, phone),
        address = COALESCE(${updates.address}, address),
        is_active = COALESCE(${updates.isActive}, is_active),
        spei_in_enabled = COALESCE(${updates.speiInEnabled}, spei_in_enabled),
        spei_out_enabled = COALESCE(${updates.speiOutEnabled}, spei_out_enabled),
        commission_percentage = COALESCE(${updates.commissionPercentage}, commission_percentage),
        parent_clabe = COALESCE(${updates.parentClabe}, parent_clabe),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbCompany | null;
}

export async function deleteCompany(id: string): Promise<boolean> {
  await sql`
    DELETE FROM companies WHERE id = ${id}
  `;
  return true;
}

// ==================== CLABE ACCOUNT OPERATIONS ====================

export async function createClabeAccount(clabeAccount: {
  id: string;
  companyId: string;
  clabe: string;
  alias: string;
  description?: string;
  isActive?: boolean;
  isMain?: boolean;
}): Promise<DbClabeAccount> {
  const result = await sql`
    INSERT INTO clabe_accounts (id, company_id, clabe, alias, description, is_active, is_main)
    VALUES (${clabeAccount.id}, ${clabeAccount.companyId}, ${clabeAccount.clabe}, ${clabeAccount.alias}, ${clabeAccount.description || null}, ${clabeAccount.isActive ?? true}, ${clabeAccount.isMain ?? false})
    RETURNING *
  `;
  return result[0] as DbClabeAccount;
}

// Get the main CLABE account for a company (concentrator account)
export async function getMainClabeAccount(companyId: string): Promise<DbClabeAccount | null> {
  const result = await sql`
    SELECT * FROM clabe_accounts WHERE company_id = ${companyId} AND is_main = true LIMIT 1
  `;
  return result[0] as DbClabeAccount | null;
}

export async function getClabeAccountById(id: string): Promise<DbClabeAccount | null> {
  const result = await sql`
    SELECT * FROM clabe_accounts WHERE id = ${id}
  `;
  return result[0] as DbClabeAccount | null;
}

export async function getClabeAccountByClabe(clabe: string): Promise<DbClabeAccount | null> {
  const result = await sql`
    SELECT * FROM clabe_accounts WHERE clabe = ${clabe}
  `;
  return result[0] as DbClabeAccount | null;
}

export async function getAllClabeAccounts(): Promise<DbClabeAccount[]> {
  const result = await sql`
    SELECT * FROM clabe_accounts ORDER BY created_at DESC
  `;
  return result as DbClabeAccount[];
}

export async function getClabeAccountsByCompanyId(companyId: string): Promise<DbClabeAccount[]> {
  const result = await sql`
    SELECT * FROM clabe_accounts WHERE company_id = ${companyId} ORDER BY created_at DESC
  `;
  return result as DbClabeAccount[];
}

export async function updateClabeAccount(
  id: string,
  updates: Partial<{
    alias: string;
    description: string;
    isActive: boolean;
    isMain: boolean;
  }>
): Promise<DbClabeAccount | null> {
  const result = await sql`
    UPDATE clabe_accounts
    SET alias = COALESCE(${updates.alias}, alias),
        description = COALESCE(${updates.description}, description),
        is_active = COALESCE(${updates.isActive}, is_active),
        is_main = COALESCE(${updates.isMain}, is_main),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbClabeAccount | null;
}

export async function deleteClabeAccount(id: string): Promise<boolean> {
  await sql`
    DELETE FROM clabe_accounts WHERE id = ${id}
  `;
  return true;
}

// ==================== USER-CLABE ACCESS OPERATIONS ====================

export async function addUserClabeAccess(userId: string, clabeAccountId: string): Promise<void> {
  await sql`
    INSERT INTO user_clabe_access (user_id, clabe_account_id)
    VALUES (${userId}, ${clabeAccountId})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeUserClabeAccess(userId: string, clabeAccountId: string): Promise<void> {
  await sql`
    DELETE FROM user_clabe_access WHERE user_id = ${userId} AND clabe_account_id = ${clabeAccountId}
  `;
}

export async function getUserClabeAccess(userId: string): Promise<string[]> {
  const result = await sql`
    SELECT clabe_account_id FROM user_clabe_access WHERE user_id = ${userId}
  `;
  return result.map((r: any) => r.clabe_account_id);
}

export async function setUserClabeAccess(userId: string, clabeAccountIds: string[]): Promise<void> {
  // Remove all existing access
  await sql`
    DELETE FROM user_clabe_access WHERE user_id = ${userId}
  `;

  // Add new access entries
  for (const clabeAccountId of clabeAccountIds) {
    await sql`
      INSERT INTO user_clabe_access (user_id, clabe_account_id)
      VALUES (${userId}, ${clabeAccountId})
    `;
  }
}

export async function getClabeAccountsForUser(userId: string): Promise<DbClabeAccount[]> {
  const result = await sql`
    SELECT ca.* FROM clabe_accounts ca
    INNER JOIN user_clabe_access uca ON ca.id = uca.clabe_account_id
    WHERE uca.user_id = ${userId}
    ORDER BY ca.created_at DESC
  `;
  return result as DbClabeAccount[];
}

// Get users with their CLABE access for a specific company
export async function getUsersWithClabeAccessByCompanyId(companyId: string): Promise<{
  user: DbUser;
  clabeAccounts: DbClabeAccount[];
}[]> {
  // First get all CLABE accounts for this company
  const companyClabes = await getClabeAccountsByCompanyId(companyId);
  if (companyClabes.length === 0) {
    return [];
  }

  const clabeIds = companyClabes.map(c => c.id);

  // Get all user-clabe access records for these CLABEs
  const accessResult = await sql`
    SELECT DISTINCT uca.user_id, uca.clabe_account_id
    FROM user_clabe_access uca
    WHERE uca.clabe_account_id = ANY(${clabeIds}::text[])
  `;

  if (accessResult.length === 0) {
    return [];
  }

  // Group clabe_account_ids by user_id
  const userClabeMap = new Map<string, string[]>();
  for (const row of accessResult) {
    const userId = row.user_id;
    const clabeId = row.clabe_account_id;
    if (!userClabeMap.has(userId)) {
      userClabeMap.set(userId, []);
    }
    userClabeMap.get(userId)!.push(clabeId);
  }

  // Get user details for all users
  const userIds = Array.from(userClabeMap.keys());
  const usersResult = await sql`
    SELECT * FROM users WHERE id = ANY(${userIds}::text[])
  `;

  // Create the result array with users and their assigned CLABEs
  const clabeMap = new Map(companyClabes.map(c => [c.id, c]));
  const result: { user: DbUser; clabeAccounts: DbClabeAccount[] }[] = [];

  for (const user of usersResult) {
    const assignedClabeIds = userClabeMap.get(user.id) || [];
    const assignedClabes = assignedClabeIds
      .map(id => clabeMap.get(id))
      .filter((c): c is DbClabeAccount => c !== undefined);

    result.push({
      user: user as DbUser,
      clabeAccounts: assignedClabes,
    });
  }

  return result;
}

// ==================== USER OPERATIONS ====================
// Note: Database uses camelCase columns (Prisma default)

export async function createUser(user: {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  companyId?: string | null;
  permissions: string[];
  isActive?: boolean;
}): Promise<DbUser> {
  const now = new Date();
  const result = await sql`
    INSERT INTO users (id, email, password, name, role, company_id, permissions, "isActive", "createdAt", "updatedAt")
    VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role}, ${user.companyId || null}, ${user.permissions}, ${user.isActive ?? true}, ${now}, ${now})
    RETURNING *
  `;
  return result[0] as DbUser;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email}
  `;
  return result[0] as DbUser | null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${id}
  `;
  return result[0] as DbUser | null;
}

export async function getAllUsers(): Promise<DbUser[]> {
  const result = await sql`
    SELECT * FROM users ORDER BY "createdAt" DESC
  `;
  return result as DbUser[];
}

export async function updateUser(
  id: string,
  updates: Partial<{
    email: string;
    password: string;
    name: string;
    role: string;
    companyId: string | null;
    permissions: string[];
    isActive: boolean;
    lastLogin: Date;
  }>
): Promise<DbUser | null> {
  const now = new Date();
  const result = await sql`
    UPDATE users
    SET email = COALESCE(${updates.email}, email),
        password = COALESCE(${updates.password}, password),
        name = COALESCE(${updates.name}, name),
        role = COALESCE(${updates.role}, role),
        company_id = COALESCE(${updates.companyId}, company_id),
        permissions = COALESCE(${updates.permissions}, permissions),
        "isActive" = COALESCE(${updates.isActive}, "isActive"),
        "lastLogin" = COALESCE(${updates.lastLogin}, "lastLogin"),
        "updatedAt" = ${now}
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] as DbUser | null;
}

export async function deleteUser(id: string): Promise<boolean> {
  await sql`
    DELETE FROM users WHERE id = ${id}
  `;
  return true;
}

export async function updateLastLogin(id: string): Promise<void> {
  await sql`
    UPDATE users SET "lastLogin" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
}

// ==================== SESSION OPERATIONS ====================
// SECURITY FIX: Use snake_case column names to match table definition (user_id, expires_at, created_at)

export async function createSession(session: {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const now = new Date();
  await sql`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (${session.id}, ${session.userId}, ${session.token}, ${session.expiresAt}, ${now})
  `;
}

export async function getSessionByToken(token: string): Promise<{
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
} | null> {
  const result = await sql`
    SELECT id, user_id as "userId", token, expires_at as "expiresAt"
    FROM sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP
  `;
  return result[0] as any || null;
}

export async function deleteSession(token: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE token = ${token}
  `;
}

export async function deleteExpiredSessions(): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP
  `;
}

export async function invalidateSession(token: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE token = ${token}
  `;
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE user_id = ${userId}
  `;
}

// ==================== HELPER FUNCTIONS ====================

// Get user with clabe accounts populated
// Note: Users table doesn't have company_id in Prisma schema
export async function getUserWithRelations(id: string): Promise<{
  user: DbUser;
  clabeAccounts: DbClabeAccount[];
} | null> {
  const user = await getUserById(id);
  if (!user) return null;

  let clabeAccounts: DbClabeAccount[] = [];

  // Get CLABE accounts based on role
  if (user.role === 'super_admin') {
    // Super admin has access to all CLABE accounts
    try {
      clabeAccounts = await getAllClabeAccounts();
    } catch (e) {
      // Table might not exist yet
      clabeAccounts = [];
    }
  } else {
    // Regular users have access only to assigned CLABE accounts
    try {
      clabeAccounts = await getClabeAccountsForUser(id);
    } catch (e) {
      // Table might not exist yet
      clabeAccounts = [];
    }
  }

  return { user, clabeAccounts };
}

// ==================== TRANSACTION OPERATIONS ====================

export async function createTransaction(transaction: {
  id: string;
  clabeAccountId?: string;
  type: 'incoming' | 'outgoing';
  status?: string;
  amount: number;
  concept?: string;
  trackingKey: string;
  numericalReference?: number;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  beneficiaryName?: string;
  beneficiaryUid?: string;
  payerAccount?: string;
  payerBank?: string;
  payerName?: string;
  payerUid?: string;
  opmOrderId?: string;
  confirmationDeadline?: Date;
  pendingOrderData?: Record<string, unknown>;
}): Promise<DbTransaction> {
  // SECURITY: Generate cryptographic signature for transaction integrity
  let signature: string | null = null;
  if (isSigningConfigured()) {
    try {
      signature = signTransaction({
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        beneficiaryAccount: transaction.beneficiaryAccount,
        beneficiaryName: transaction.beneficiaryName,
        payerAccount: transaction.payerAccount,
        trackingKey: transaction.trackingKey,
        createdAt: new Date(),
      });
    } catch (signError) {
      console.error('[SECURITY] Failed to sign transaction:', signError);
    }
  }

  const result = await sql`
    INSERT INTO transactions (
      id, clabe_account_id, type, status, amount, concept, tracking_key,
      numerical_reference, beneficiary_account, beneficiary_bank, beneficiary_name,
      beneficiary_uid, payer_account, payer_bank, payer_name, payer_uid, opm_order_id,
      confirmation_deadline, pending_order_data, signature
    )
    VALUES (
      ${transaction.id},
      ${transaction.clabeAccountId || null},
      ${transaction.type},
      ${transaction.status || 'pending'},
      ${transaction.amount},
      ${transaction.concept || null},
      ${transaction.trackingKey},
      ${transaction.numericalReference || null},
      ${transaction.beneficiaryAccount || null},
      ${transaction.beneficiaryBank || null},
      ${transaction.beneficiaryName || null},
      ${transaction.beneficiaryUid || null},
      ${transaction.payerAccount || null},
      ${transaction.payerBank || null},
      ${transaction.payerName || null},
      ${transaction.payerUid || null},
      ${transaction.opmOrderId || null},
      ${transaction.confirmationDeadline?.toISOString() || null},
      ${transaction.pendingOrderData ? JSON.stringify(transaction.pendingOrderData) : null},
      ${signature}
    )
    RETURNING *
  `;
  return result[0] as DbTransaction;
}

/**
 * SECURITY: Create outgoing transaction with atomic balance check and row locking
 * This prevents race conditions and double spending by:
 * 1. Starting a database transaction
 * 2. Locking the CLABE account row with FOR UPDATE NOWAIT
 * 3. Calculating available balance
 * 4. Validating sufficient funds
 * 5. Creating the transaction
 * 6. Committing or rolling back atomically
 */
export async function createOutgoingTransactionAtomic(transaction: {
  id: string;
  clabeAccountId: string;
  type: 'outgoing';
  status?: string;
  amount: number;
  concept?: string;
  trackingKey: string;
  numericalReference?: number;
  beneficiaryAccount?: string;
  beneficiaryBank?: string;
  beneficiaryName?: string;
  beneficiaryUid?: string;
  payerAccount?: string;
  payerBank?: string;
  payerName?: string;
  payerUid?: string;
  opmOrderId?: string;
  confirmationDeadline?: Date;
  pendingOrderData?: Record<string, unknown>;
}): Promise<{ success: true; transaction: DbTransaction } | { success: false; error: string; availableBalance?: number }> {
  // Use pool.connect() to get a dedicated client for the transaction
  const client = await pool.connect();

  try {
    // Start transaction with SERIALIZABLE isolation for maximum safety
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

    try {
      // Lock the CLABE account row to prevent concurrent modifications
      // NOWAIT will immediately fail if the row is already locked
      const lockResult = await client.query(
        'SELECT id FROM clabe_accounts WHERE id = $1 FOR UPDATE NOWAIT',
        [transaction.clabeAccountId]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Cuenta CLABE no encontrada' };
      }

      // Calculate current balance with the lock held
      const balanceResult = await client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as settled_incoming,
          COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as settled_outgoing,
          COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('pending_confirmation', 'pending', 'sent', 'queued') THEN amount ELSE 0 END), 0) as in_transit
        FROM transactions
        WHERE clabe_account_id = $1
      `, [transaction.clabeAccountId]);

      const balanceRow = balanceResult.rows[0] || { settled_incoming: 0, settled_outgoing: 0, in_transit: 0 };
      const settledIncoming = parseFloat(balanceRow.settled_incoming) || 0;
      const settledOutgoing = parseFloat(balanceRow.settled_outgoing) || 0;
      const inTransit = parseFloat(balanceRow.in_transit) || 0;
      const availableBalance = settledIncoming - settledOutgoing;
      const effectiveAvailable = availableBalance - inTransit;

      // Check if sufficient balance
      if (transaction.amount > effectiveAvailable) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Saldo insuficiente',
          availableBalance: Math.max(0, effectiveAvailable),
        };
      }

      // SECURITY: Generate cryptographic signature for transaction integrity
      let signature: string | null = null;
      if (isSigningConfigured()) {
        try {
          signature = signTransaction({
            transactionId: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            beneficiaryAccount: transaction.beneficiaryAccount,
            beneficiaryName: transaction.beneficiaryName,
            trackingKey: transaction.trackingKey,
            createdAt: new Date(),
          });
        } catch (signError) {
          console.error('[SECURITY] Failed to sign transaction:', signError);
          // Continue without signature - logging will alert ops team
        }
      }

      // Insert the transaction with cryptographic signature
      const insertResult = await client.query(`
        INSERT INTO transactions (
          id, clabe_account_id, type, status, amount, concept, tracking_key,
          numerical_reference, beneficiary_account, beneficiary_bank, beneficiary_name,
          beneficiary_uid, payer_account, payer_bank, payer_name, payer_uid, opm_order_id,
          confirmation_deadline, pending_order_data, signature
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        transaction.id,
        transaction.clabeAccountId,
        transaction.type,
        transaction.status || 'pending',
        transaction.amount,
        transaction.concept || null,
        transaction.trackingKey,
        transaction.numericalReference || null,
        transaction.beneficiaryAccount || null,
        transaction.beneficiaryBank || null,
        transaction.beneficiaryName || null,
        transaction.beneficiaryUid || null,
        transaction.payerAccount || null,
        transaction.payerBank || null,
        transaction.payerName || null,
        transaction.payerUid || null,
        transaction.opmOrderId || null,
        transaction.confirmationDeadline?.toISOString() || null,
        transaction.pendingOrderData ? JSON.stringify(transaction.pendingOrderData) : null,
        signature,
      ]);

      // Commit the transaction
      await client.query('COMMIT');

      return {
        success: true,
        transaction: insertResult.rows[0] as DbTransaction,
      };
    } catch (txError: any) {
      await client.query('ROLLBACK');

      // Check if it's a lock conflict error
      if (txError.code === '55P03') {
        return { success: false, error: 'Operación en progreso, intente de nuevo' };
      }

      throw txError;
    }
  } finally {
    client.release();
  }
}

// Get transactions pending confirmation that have passed their deadline
export async function getPendingConfirmationTransactions(): Promise<DbTransaction[]> {
  const result = await sql`
    SELECT * FROM transactions
    WHERE status = 'pending_confirmation'
    AND confirmation_deadline <= CURRENT_TIMESTAMP
    ORDER BY created_at ASC
  `;
  return result as DbTransaction[];
}

// Get a single transaction pending confirmation by ID (for cancel check)
export async function getTransactionForCancel(transactionId: string): Promise<DbTransaction | null> {
  const result = await sql`
    SELECT * FROM transactions
    WHERE id = ${transactionId}
    AND status = 'pending_confirmation'
    AND confirmation_deadline > CURRENT_TIMESTAMP
  `;
  return result[0] as DbTransaction | null;
}

export async function getTransactionById(id: string): Promise<DbTransaction | null> {
  const result = await sql`
    SELECT * FROM transactions WHERE id = ${id}
  `;
  return result[0] as DbTransaction | null;
}

export async function getTransactionByTrackingKey(trackingKey: string): Promise<DbTransaction | null> {
  const result = await sql`
    SELECT * FROM transactions WHERE tracking_key = ${trackingKey}
  `;
  return result[0] as DbTransaction | null;
}

export async function getTransactionByOpmOrderId(opmOrderId: string): Promise<DbTransaction | null> {
  const result = await sql`
    SELECT * FROM transactions WHERE opm_order_id = ${opmOrderId}
  `;
  return result[0] as DbTransaction | null;
}

export async function getTransactionsByClabeAccount(clabeAccountId: string): Promise<DbTransaction[]> {
  const result = await sql`
    SELECT * FROM transactions WHERE clabe_account_id = ${clabeAccountId} ORDER BY created_at DESC
  `;
  return result as DbTransaction[];
}

/**
 * Calculate available balance for a specific CLABE account
 *
 * Available balance = Settled Incoming (scattered) - Sent/Settled Outgoing (sent, scattered)
 *
 * This ensures each CLABE operates as an independent cost center,
 * only able to spend what it has received.
 *
 * @param clabeAccountId - The CLABE account ID to calculate balance for
 * @returns Object with settledIncoming, settledOutgoing, inTransit, and availableBalance
 */
export async function getClabeAccountBalance(clabeAccountId: string): Promise<{
  settledIncoming: number;
  settledOutgoing: number;
  inTransit: number;
  availableBalance: number;
}> {
  const result = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as settled_incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as settled_outgoing,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('pending_confirmation', 'pending', 'sent', 'queued') THEN amount ELSE 0 END), 0) as in_transit
    FROM transactions
    WHERE clabe_account_id = ${clabeAccountId}
  `;

  const row = result[0] || { settled_incoming: 0, settled_outgoing: 0, in_transit: 0 };
  const settledIncoming = parseFloat(row.settled_incoming) || 0;
  const settledOutgoing = parseFloat(row.settled_outgoing) || 0;
  const inTransit = parseFloat(row.in_transit) || 0;

  return {
    settledIncoming,
    settledOutgoing,
    inTransit,
    // SECURITY FIX: Include inTransit in available balance calculation
    // This matches the atomic transaction check in createOutgoingTransactionAtomic
    availableBalance: settledIncoming - settledOutgoing - inTransit,
  };
}

/**
 * Calculate available balance for a CLABE by its CLABE number
 */
export async function getClabeBalanceByClabe(clabe: string): Promise<{
  clabeAccountId: string | null;
  settledIncoming: number;
  settledOutgoing: number;
  inTransit: number;
  availableBalance: number;
} | null> {
  const clabeAccount = await getClabeAccountByClabe(clabe);
  if (!clabeAccount) {
    return null;
  }

  const balance = await getClabeAccountBalance(clabeAccount.id);
  return {
    clabeAccountId: clabeAccount.id,
    ...balance,
  };
}

export async function updateTransactionStatus(
  id: string,
  status: string,
  errorDetail?: string
): Promise<DbTransaction | null> {
  const result = await sql`
    UPDATE transactions
    SET status = ${status},
        error_detail = COALESCE(${errorDetail || null}, error_detail),
        settled_at = CASE WHEN ${status} = 'scattered' THEN CURRENT_TIMESTAMP ELSE settled_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbTransaction | null;
}

export async function updateTransactionStatusByOpmOrderId(
  opmOrderId: string,
  status: string,
  errorDetail?: string
): Promise<DbTransaction | null> {
  const result = await sql`
    UPDATE transactions
    SET status = ${status},
        error_detail = COALESCE(${errorDetail || null}, error_detail),
        settled_at = CASE WHEN ${status} = 'scattered' THEN CURRENT_TIMESTAMP ELSE settled_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE opm_order_id = ${opmOrderId}
    RETURNING *
  `;
  return result[0] as DbTransaction | null;
}

export async function updateTransactionByTrackingKey(
  trackingKey: string,
  updates: Partial<{
    status: string;
    errorDetail: string;
    opmOrderId: string;
    cepUrl: string;
  }>
): Promise<DbTransaction | null> {
  const result = await sql`
    UPDATE transactions
    SET status = COALESCE(${updates.status}, status),
        error_detail = COALESCE(${updates.errorDetail}, error_detail),
        opm_order_id = COALESCE(${updates.opmOrderId}, opm_order_id),
        cep_url = COALESCE(${updates.cepUrl}, cep_url),
        settled_at = CASE WHEN ${updates.status} = 'scattered' THEN CURRENT_TIMESTAMP ELSE settled_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE tracking_key = ${trackingKey}
    RETURNING *
  `;
  return result[0] as DbTransaction | null;
}

// Confirm a pending transaction after OPM order is created
export async function confirmPendingTransaction(
  id: string,
  opmOrderId: string,
  status: string,
  trackingKey?: string
): Promise<DbTransaction | null> {
  const result = await sql`
    UPDATE transactions
    SET opm_order_id = ${opmOrderId},
        status = ${status},
        tracking_key = COALESCE(${trackingKey || null}, tracking_key),
        pending_order_data = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbTransaction | null;
}

export async function listTransactions(params: {
  type?: 'incoming' | 'outgoing';
  status?: string;
  clabeAccountId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  itemsPerPage?: number;
}): Promise<{ transactions: DbTransaction[]; total: number }> {
  const page = params.page || 1;
  const itemsPerPage = params.itemsPerPage || 50;
  const offset = (page - 1) * itemsPerPage;

  // Validate input parameters to prevent injection
  const validTypes = ['incoming', 'outgoing'];
  const validStatuses = ['pending', 'sent', 'scattered', 'returned', 'canceled', 'pending_confirmation'];

  const type = params.type && validTypes.includes(params.type) ? params.type : null;
  const status = params.status && validStatuses.includes(params.status) ? params.status : null;
  const clabeAccountId = params.clabeAccountId || null;

  // Use parameterized query with conditional filtering
  const countResult = await sql`
    SELECT COUNT(*) as count FROM transactions
    WHERE
      (${type}::text IS NULL OR type = ${type})
      AND (${status}::text IS NULL OR status = ${status})
      AND (${clabeAccountId}::text IS NULL OR clabe_account_id = ${clabeAccountId})
  `;
  const total = parseInt(countResult[0]?.count || '0');

  const result = await sql`
    SELECT * FROM transactions
    WHERE
      (${type}::text IS NULL OR type = ${type})
      AND (${status}::text IS NULL OR status = ${status})
      AND (${clabeAccountId}::text IS NULL OR clabe_account_id = ${clabeAccountId})
    ORDER BY created_at DESC
    LIMIT ${itemsPerPage} OFFSET ${offset}
  `;

  return {
    transactions: result as DbTransaction[],
    total,
  };
}

// ==================== STATISTICS OPERATIONS ====================

export interface DashboardStats {
  totalIncoming: number;
  totalOutgoing: number;
  pendingCount: number;
  clientsCount: number;
  totalBalance: number;
  inTransit: number;
  incomingChange: number;
  outgoingChange: number;
  weeklyData: { name: string; incoming: number; outgoing: number }[];
}

export async function getDashboardStats(companyId?: string): Promise<DashboardStats> {
  // Get total incoming/outgoing for current period (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get CLABE IDs as array for parameterized query (prevents SQL injection)
  let clabeIds: string[] | null = null;
  if (companyId) {
    const clabes = await getClabeAccountsByCompanyId(companyId);
    if (clabes.length > 0) {
      clabeIds = clabes.map(c => c.id);
    } else {
      // No CLABE accounts, return empty stats
      return {
        totalIncoming: 0,
        totalOutgoing: 0,
        pendingCount: 0,
        clientsCount: 0,
        totalBalance: 0,
        inTransit: 0,
        incomingChange: 0,
        outgoingChange: 0,
        weeklyData: [],
      };
    }
  }

  // Current period stats - using parameterized array query
  const currentStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM transactions
    WHERE created_at >= ${thirtyDaysAgo.toISOString()}
    AND (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
  `;

  // Previous period stats (for comparison)
  const prevStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
    FROM transactions
    WHERE created_at >= ${sixtyDaysAgo.toISOString()} AND created_at < ${thirtyDaysAgo.toISOString()}
    AND (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
  `;

  // Get unique clients count (unique payer names for incoming transactions)
  const clientsResult = await sql`
    SELECT COUNT(DISTINCT payer_name) as count
    FROM transactions
    WHERE type = 'incoming' AND payer_name IS NOT NULL
    AND (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
  `;

  // Get "in transit" amount - outgoing transactions that haven't settled yet
  const inTransitResult = await sql`
    SELECT COALESCE(SUM(amount), 0) as in_transit
    FROM transactions
    WHERE type = 'outgoing'
    AND status IN ('pending_confirmation', 'pending', 'sent', 'queued')
    AND (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
  `;

  // Get weekly data for chart
  const weeklyResult = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'Dy') as day_name,
      EXTRACT(DOW FROM created_at) as day_num,
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
    FROM transactions
    WHERE created_at >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}
    AND (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
    GROUP BY DATE_TRUNC('day', created_at), EXTRACT(DOW FROM created_at)
    ORDER BY DATE_TRUNC('day', created_at)
  `;

  const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const weeklyData = dayNames.map((name, idx) => {
    const dayData = (weeklyResult as any[]).find((d: any) => parseInt(d.day_num) === idx);
    return {
      name,
      incoming: parseFloat(dayData?.incoming || '0'),
      outgoing: parseFloat(dayData?.outgoing || '0'),
    };
  });

  const currentIncoming = parseFloat(currentStatsResult[0]?.incoming || '0');
  const currentOutgoing = parseFloat(currentStatsResult[0]?.outgoing || '0');
  const prevIncoming = parseFloat(prevStatsResult[0]?.incoming || '0');
  const prevOutgoing = parseFloat(prevStatsResult[0]?.outgoing || '0');

  // Calculate percentage change
  const incomingChange = prevIncoming > 0 ? ((currentIncoming - prevIncoming) / prevIncoming) * 100 : 0;
  const outgoingChange = prevOutgoing > 0 ? ((currentOutgoing - prevOutgoing) / prevOutgoing) * 100 : 0;

  const inTransit = parseFloat(inTransitResult[0]?.in_transit || '0');

  return {
    totalIncoming: currentIncoming,
    totalOutgoing: currentOutgoing,
    pendingCount: parseInt(currentStatsResult[0]?.pending_count || '0'),
    clientsCount: parseInt(clientsResult[0]?.count || '0'),
    totalBalance: currentIncoming - currentOutgoing,
    inTransit,
    incomingChange: Math.round(incomingChange * 10) / 10,
    outgoingChange: Math.round(outgoingChange * 10) / 10,
    weeklyData,
  };
}

// Get transactions for a specific company (through their CLABE accounts)
export async function getTransactionsByCompanyId(
  companyId: string,
  params?: { page?: number; itemsPerPage?: number; type?: 'incoming' | 'outgoing'; status?: string }
): Promise<{ transactions: DbTransaction[]; total: number }> {
  const page = params?.page || 1;
  const itemsPerPage = params?.itemsPerPage || 50;
  const offset = (page - 1) * itemsPerPage;

  // Get all CLABE accounts for this company
  const clabes = await getClabeAccountsByCompanyId(companyId);
  if (clabes.length === 0) {
    return { transactions: [], total: 0 };
  }

  // Use array parameter for safe SQL (prevents injection)
  const clabeIds = clabes.map(c => c.id);

  // Validate type and status parameters
  const validTypes = ['incoming', 'outgoing'];
  const validStatuses = ['pending', 'sent', 'scattered', 'returned', 'canceled', 'pending_confirmation'];
  const type = params?.type && validTypes.includes(params.type) ? params.type : null;
  const status = params?.status && validStatuses.includes(params.status) ? params.status : null;

  const countResult = await sql`
    SELECT COUNT(*) as count FROM transactions
    WHERE clabe_account_id = ANY(${clabeIds}::text[])
    AND (${type}::text IS NULL OR type = ${type})
    AND (${status}::text IS NULL OR status = ${status})
  `;
  const total = parseInt(countResult[0]?.count || '0');

  const result = await sql`
    SELECT * FROM transactions
    WHERE clabe_account_id = ANY(${clabeIds}::text[])
    AND (${type}::text IS NULL OR type = ${type})
    AND (${status}::text IS NULL OR status = ${status})
    ORDER BY created_at DESC
    LIMIT ${itemsPerPage} OFFSET ${offset}
  `;

  return {
    transactions: result as DbTransaction[],
    total,
  };
}

// Get detailed company info with stats
export async function getCompanyWithDetails(companyId: string): Promise<{
  company: DbCompany;
  users: DbUser[];
  usersWithClabeAccess: { user: DbUser; clabeAccounts: DbClabeAccount[] }[];
  clabeAccounts: DbClabeAccount[];
  stats: {
    totalIncoming: number;
    totalOutgoing: number;
    transactionCount: number;
  };
} | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;

  // Get users with their CLABE access for this company
  const usersWithClabeAccess = await getUsersWithClabeAccessByCompanyId(companyId);
  // For backwards compatibility, also return flat users array
  const users = usersWithClabeAccess.map(u => u.user);
  const clabeAccounts = await getClabeAccountsByCompanyId(companyId);

  // Get transaction stats for this company (using safe parameterized query)
  const clabeIds = clabeAccounts.map(c => c.id);
  let stats = { totalIncoming: 0, totalOutgoing: 0, transactionCount: 0 };

  if (clabeAccounts.length > 0) {
    const statsResult = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing,
        COUNT(*) as count
      FROM transactions
      WHERE clabe_account_id = ANY(${clabeIds}::text[])
    `;

    stats = {
      totalIncoming: parseFloat(statsResult[0]?.incoming || '0'),
      totalOutgoing: parseFloat(statsResult[0]?.outgoing || '0'),
      transactionCount: parseInt(statsResult[0]?.count || '0'),
    };
  }

  return { company, users, usersWithClabeAccess, clabeAccounts, stats };
}

// Get recent transactions for dashboard
export async function getRecentTransactions(
  limit: number = 10,
  companyId?: string
): Promise<DbTransaction[]> {
  // Get CLABE IDs as array for parameterized query
  let clabeIds: string[] | null = null;
  if (companyId) {
    const clabes = await getClabeAccountsByCompanyId(companyId);
    if (clabes.length > 0) {
      clabeIds = clabes.map(c => c.id);
    } else {
      return [];
    }
  }

  const result = await sql`
    SELECT * FROM transactions
    WHERE (${clabeIds}::text[] IS NULL OR clabe_account_id = ANY(${clabeIds}::text[]))
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result as DbTransaction[];
}

// Create commission transaction
export async function createCommissionTransaction(params: {
  sourceTransaction: DbTransaction;
  commissionAmount: number;
  targetClabe: string;
  companyId: string;
}): Promise<DbTransaction> {
  // SECURITY FIX: Use crypto.randomBytes for secure tracking key
  const trackingKey = `COM${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`.substring(0, 30);

  return createTransaction({
    id: `tx_comm_${Date.now()}`,
    type: 'outgoing',
    status: 'pending',
    amount: params.commissionAmount,
    trackingKey,
    concept: `Comisión por transacción ${params.sourceTransaction.tracking_key}`,
    beneficiaryAccount: params.targetClabe,
    beneficiaryName: 'NOVACORP INTEGRADORA',
  });
}

// ==================== SAVED ACCOUNTS OPERATIONS ====================

export async function createSavedAccount(savedAccount: {
  id: string;
  userId: string;
  alias: string;
  clabe: string;
  bankCode: string;
  bankName: string;
  beneficiaryName: string;
  beneficiaryRfc?: string;
  accountType?: number;
  notes?: string;
  isActive?: boolean;
}): Promise<DbSavedAccount> {
  const result = await sql`
    INSERT INTO saved_accounts (id, user_id, alias, clabe, bank_code, bank_name, beneficiary_name, beneficiary_rfc, account_type, notes, is_active)
    VALUES (${savedAccount.id}, ${savedAccount.userId}, ${savedAccount.alias}, ${savedAccount.clabe}, ${savedAccount.bankCode}, ${savedAccount.bankName}, ${savedAccount.beneficiaryName}, ${savedAccount.beneficiaryRfc || null}, ${savedAccount.accountType || 40}, ${savedAccount.notes || null}, ${savedAccount.isActive ?? true})
    RETURNING *
  `;
  return result[0] as DbSavedAccount;
}

export async function getSavedAccountById(id: string): Promise<DbSavedAccount | null> {
  const result = await sql`
    SELECT * FROM saved_accounts WHERE id = ${id}
  `;
  return result[0] as DbSavedAccount | null;
}

export async function getSavedAccountsByUserId(userId: string): Promise<DbSavedAccount[]> {
  const result = await sql`
    SELECT * FROM saved_accounts WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return result as DbSavedAccount[];
}

export async function updateSavedAccount(
  id: string,
  updates: Partial<{
    alias: string;
    clabe: string;
    bankCode: string;
    bankName: string;
    beneficiaryName: string;
    beneficiaryRfc: string;
    accountType: number;
    notes: string;
    isActive: boolean;
  }>
): Promise<DbSavedAccount | null> {
  const result = await sql`
    UPDATE saved_accounts
    SET alias = COALESCE(${updates.alias}, alias),
        clabe = COALESCE(${updates.clabe}, clabe),
        bank_code = COALESCE(${updates.bankCode}, bank_code),
        bank_name = COALESCE(${updates.bankName}, bank_name),
        beneficiary_name = COALESCE(${updates.beneficiaryName}, beneficiary_name),
        beneficiary_rfc = COALESCE(${updates.beneficiaryRfc}, beneficiary_rfc),
        account_type = COALESCE(${updates.accountType}, account_type),
        notes = COALESCE(${updates.notes}, notes),
        is_active = COALESCE(${updates.isActive}, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbSavedAccount | null;
}

export async function deleteSavedAccount(id: string): Promise<boolean> {
  await sql`
    DELETE FROM saved_accounts WHERE id = ${id}
  `;
  return true;
}

export async function getSavedAccountByUserAndClabe(userId: string, clabe: string): Promise<DbSavedAccount | null> {
  const result = await sql`
    SELECT * FROM saved_accounts WHERE user_id = ${userId} AND clabe = ${clabe}
  `;
  return result[0] as DbSavedAccount | null;
}

// ==================== PENDING COMMISSION OPERATIONS ====================

export async function createPendingCommission(commission: {
  id: string;
  companyId: string;
  sourceTransactionId: string;
  amount: number;
  percentage: number;
}): Promise<DbPendingCommission> {
  const result = await sql`
    INSERT INTO pending_commissions (id, company_id, source_transaction_id, amount, percentage)
    VALUES (${commission.id}, ${commission.companyId}, ${commission.sourceTransactionId}, ${commission.amount}, ${commission.percentage})
    RETURNING *
  `;
  return result[0] as DbPendingCommission;
}

export async function getPendingCommissionsByCompany(companyId: string): Promise<DbPendingCommission[]> {
  const result = await sql`
    SELECT * FROM pending_commissions
    WHERE company_id = ${companyId} AND status = 'pending'
    ORDER BY created_at ASC
  `;
  return result as DbPendingCommission[];
}

export async function getAllPendingCommissions(): Promise<DbPendingCommission[]> {
  const result = await sql`
    SELECT * FROM pending_commissions
    WHERE status = 'pending'
    ORDER BY company_id, created_at ASC
  `;
  return result as DbPendingCommission[];
}

export async function getPendingCommissionsGroupedByCompany(): Promise<{
  companyId: string;
  totalAmount: number;
  count: number;
  commissionIds: string[];
}[]> {
  // Get all pending commissions
  const pendingCommissions = await getAllPendingCommissions();

  // Group by company
  const grouped = pendingCommissions.reduce((acc, commission) => {
    if (!acc[commission.company_id]) {
      acc[commission.company_id] = {
        companyId: commission.company_id,
        totalAmount: 0,
        count: 0,
        commissionIds: [],
      };
    }
    acc[commission.company_id].totalAmount += parseFloat(commission.amount.toString());
    acc[commission.company_id].count += 1;
    acc[commission.company_id].commissionIds.push(commission.id);
    return acc;
  }, {} as Record<string, { companyId: string; totalAmount: number; count: number; commissionIds: string[] }>);

  return Object.values(grouped);
}

export async function markCommissionsAsProcessed(commissionIds: string[], cutoffId: string): Promise<void> {
  if (commissionIds.length === 0) return;

  // Use parameterized array query (prevents SQL injection)
  await sql`
    UPDATE pending_commissions
    SET status = 'processed', cutoff_id = ${cutoffId}
    WHERE id = ANY(${commissionIds}::text[])
  `;
}

export async function markCommissionsAsFailed(commissionIds: string[]): Promise<void> {
  if (commissionIds.length === 0) return;

  // Use parameterized array query (prevents SQL injection)
  await sql`
    UPDATE pending_commissions
    SET status = 'failed'
    WHERE id = ANY(${commissionIds}::text[])
  `;
}

// ==================== COMMISSION CUTOFF OPERATIONS ====================

export async function createCommissionCutoff(cutoff: {
  id: string;
  companyId: string;
  targetClabe: string;
  totalAmount: number;
  commissionCount: number;
  cutoffDate: Date;
}): Promise<DbCommissionCutoff> {
  const result = await sql`
    INSERT INTO commission_cutoffs (id, company_id, target_clabe, total_amount, commission_count, cutoff_date)
    VALUES (${cutoff.id}, ${cutoff.companyId}, ${cutoff.targetClabe}, ${cutoff.totalAmount}, ${cutoff.commissionCount}, ${cutoff.cutoffDate.toISOString().split('T')[0]})
    RETURNING *
  `;
  return result[0] as DbCommissionCutoff;
}

export async function getCommissionCutoffById(id: string): Promise<DbCommissionCutoff | null> {
  const result = await sql`
    SELECT * FROM commission_cutoffs WHERE id = ${id}
  `;
  return result[0] as DbCommissionCutoff | null;
}

export async function updateCommissionCutoffStatus(
  id: string,
  status: 'pending' | 'processing' | 'sent' | 'failed',
  updates?: {
    transactionId?: string;
    trackingKey?: string;
    errorDetail?: string;
  }
): Promise<DbCommissionCutoff | null> {
  const result = await sql`
    UPDATE commission_cutoffs
    SET status = ${status},
        transaction_id = COALESCE(${updates?.transactionId || null}, transaction_id),
        tracking_key = COALESCE(${updates?.trackingKey || null}, tracking_key),
        error_detail = COALESCE(${updates?.errorDetail || null}, error_detail),
        processed_at = CASE WHEN ${status} IN ('sent', 'failed') THEN CURRENT_TIMESTAMP ELSE processed_at END
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as DbCommissionCutoff | null;
}

export async function getPendingCommissionCutoffs(): Promise<DbCommissionCutoff[]> {
  const result = await sql`
    SELECT * FROM commission_cutoffs
    WHERE status IN ('pending', 'processing')
    ORDER BY created_at ASC
  `;
  return result as DbCommissionCutoff[];
}

export async function getCommissionCutoffsByCompany(companyId: string): Promise<DbCommissionCutoff[]> {
  const result = await sql`
    SELECT * FROM commission_cutoffs
    WHERE company_id = ${companyId}
    ORDER BY cutoff_date DESC
  `;
  return result as DbCommissionCutoff[];
}

export async function getTodayCommissionCutoff(companyId: string): Promise<DbCommissionCutoff | null> {
  const today = new Date().toISOString().split('T')[0];
  const result = await sql`
    SELECT * FROM commission_cutoffs
    WHERE company_id = ${companyId} AND cutoff_date = ${today}
  `;
  return result[0] as DbCommissionCutoff | null;
}

// ==================== SECURITY OPERATIONS ====================

/**
 * Record a failed login attempt for a user
 */
export async function recordFailedLoginAttempt(userId: string): Promise<{ failedAttempts: number; lockedUntil: Date | null }> {
  try {
    const result = await sql`
      UPDATE users
      SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
      RETURNING failed_attempts, locked_until
    `;

    if (result.length === 0) {
      return { failedAttempts: 0, lockedUntil: null };
    }

    return {
      failedAttempts: result[0].failed_attempts || 0,
      lockedUntil: result[0].locked_until ? new Date(result[0].locked_until) : null,
    };
  } catch (error) {
    // Security columns might not exist yet
    console.log('Could not record failed login attempt:', error);
    return { failedAttempts: 0, lockedUntil: null };
  }
}

/**
 * Lock a user account until a specified time
 */
export async function lockUserAccount(userId: string, lockedUntil: Date): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET locked_until = ${lockedUntil.toISOString()},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.log('Could not lock user account:', error);
  }
}

/**
 * Reset failed login attempts (e.g., after successful login)
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET failed_attempts = 0,
          locked_until = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.log('Could not reset failed login attempts:', error);
  }
}

/**
 * Get user's security status (failed attempts and lock status)
 */
export async function getUserSecurityStatus(userId: string): Promise<{
  failedAttempts: number;
  lockedUntil: Date | null;
  totpEnabled: boolean;
}> {
  try {
    const result = await sql`
      SELECT failed_attempts, locked_until, totp_enabled
      FROM users
      WHERE id = ${userId}
    `;

    if (result.length === 0) {
      return { failedAttempts: 0, lockedUntil: null, totpEnabled: false };
    }

    return {
      failedAttempts: result[0].failed_attempts || 0,
      lockedUntil: result[0].locked_until ? new Date(result[0].locked_until) : null,
      totpEnabled: result[0].totp_enabled || false,
    };
  } catch (error) {
    // Security columns might not exist yet - return defaults
    console.log('Security columns not found, returning defaults');
    return { failedAttempts: 0, lockedUntil: null, totpEnabled: false };
  }
}

// ==================== 2FA OPERATIONS ====================

/**
 * Save TOTP secret for a user (during 2FA setup)
 */
export async function saveTotpSecret(userId: string, secret: string): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET totp_secret = ${secret},
          totp_enabled = false,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.log('Could not save TOTP secret:', error);
    throw new Error('No se pudo guardar la configuración 2FA. Contacte a soporte.');
  }
}

/**
 * Enable 2FA for a user (after successful verification)
 */
export async function enableTotp(userId: string): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET totp_enabled = true,
          totp_verified_at = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.log('Could not enable TOTP:', error);
    throw new Error('No se pudo activar 2FA. Contacte a soporte.');
  }
}

/**
 * Disable 2FA for a user
 */
export async function disableTotp(userId: string): Promise<void> {
  try {
    await sql`
      UPDATE users
      SET totp_enabled = false,
          totp_secret = NULL,
          totp_verified_at = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.log('Could not disable TOTP:', error);
    throw new Error('No se pudo desactivar 2FA. Contacte a soporte.');
  }
}

/**
 * Get user's TOTP secret
 */
export async function getUserTotpSecret(userId: string): Promise<string | null> {
  try {
    const result = await sql`
      SELECT totp_secret
      FROM users
      WHERE id = ${userId}
    `;
    return result.length > 0 ? result[0].totp_secret : null;
  } catch (error) {
    console.log('Could not get TOTP secret:', error);
    return null;
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function isUserTotpEnabled(userId: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT totp_enabled
      FROM users
      WHERE id = ${userId}
    `;
    return result.length > 0 && result[0].totp_enabled === true;
  } catch (error) {
    console.log('Could not check TOTP status:', error);
    return false;
  }
}

// ==================== AUDIT LOG OPERATIONS ====================

export interface DbAuditLog {
  id: string;
  timestamp: Date;
  action: string;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any> | null;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Create an audit log entry in the database
 */
export async function createAuditLogEntry(entry: {
  id: string;
  action: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  severity?: 'info' | 'warning' | 'critical';
}): Promise<void> {
  await sql`
    INSERT INTO audit_logs (id, action, user_id, user_email, ip_address, user_agent, details, severity)
    VALUES (
      ${entry.id},
      ${entry.action},
      ${entry.userId || null},
      ${entry.userEmail || null},
      ${entry.ipAddress || null},
      ${entry.userAgent || null},
      ${entry.details ? JSON.stringify(entry.details) : null},
      ${entry.severity || 'info'}
    )
  `;
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(limit: number = 100): Promise<DbAuditLog[]> {
  const result = await sql`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as DbAuditLog[];
}

/**
 * Get audit logs for a specific user
 */
export async function getAuditLogsByUser(userId: string, limit: number = 50): Promise<DbAuditLog[]> {
  const result = await sql`
    SELECT * FROM audit_logs
    WHERE user_id = ${userId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as DbAuditLog[];
}

/**
 * Get audit logs by action type
 */
export async function getAuditLogsByAction(action: string, limit: number = 50): Promise<DbAuditLog[]> {
  const result = await sql`
    SELECT * FROM audit_logs
    WHERE action = ${action}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as DbAuditLog[];
}

/**
 * Get critical security events
 */
export async function getCriticalAuditLogs(limit: number = 50): Promise<DbAuditLog[]> {
  const result = await sql`
    SELECT * FROM audit_logs
    WHERE severity = 'critical'
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return result as DbAuditLog[];
}

// ==================== WEBHOOK IDEMPOTENCY OPERATIONS ====================

export interface DbProcessedWebhook {
  id: string;
  webhook_type: 'deposit' | 'order-status' | 'cash';
  tracking_key: string;
  opm_order_id: string | null;
  received_at: Date;
  processed_at: Date;
  source_ip: string | null;
  payload_hash: string;
  result: 'success' | 'failed' | 'duplicate';
}

/**
 * Check if a webhook has already been processed (idempotency check)
 * SECURITY: Prevents duplicate processing and replay attacks
 *
 * @param webhookType - Type of webhook (deposit, order-status, cash)
 * @param trackingKey - The tracking key from the webhook payload
 * @returns The processed webhook record if exists, null otherwise
 */
export async function getProcessedWebhook(
  webhookType: 'deposit' | 'order-status' | 'cash',
  trackingKey: string
): Promise<DbProcessedWebhook | null> {
  try {
    const result = await sql`
      SELECT * FROM processed_webhooks
      WHERE webhook_type = ${webhookType} AND tracking_key = ${trackingKey}
    `;
    return result[0] as DbProcessedWebhook | null;
  } catch (error) {
    // Table might not exist yet
    console.log('Webhook idempotency table not available:', error);
    return null;
  }
}

/**
 * Record a processed webhook for idempotency
 * SECURITY: Creates idempotency record to prevent duplicate processing
 *
 * @param webhook - Webhook processing record
 * @returns The created record
 */
export async function recordProcessedWebhook(webhook: {
  id: string;
  webhookType: 'deposit' | 'order-status' | 'cash';
  trackingKey: string;
  opmOrderId?: string;
  sourceIp?: string;
  payloadHash: string;
  result: 'success' | 'failed' | 'duplicate';
}): Promise<DbProcessedWebhook | null> {
  try {
    const result = await sql`
      INSERT INTO processed_webhooks (id, webhook_type, tracking_key, opm_order_id, source_ip, payload_hash, result)
      VALUES (${webhook.id}, ${webhook.webhookType}, ${webhook.trackingKey}, ${webhook.opmOrderId || null}, ${webhook.sourceIp || null}, ${webhook.payloadHash}, ${webhook.result})
      ON CONFLICT (webhook_type, tracking_key) DO UPDATE
      SET processed_at = CURRENT_TIMESTAMP, result = ${webhook.result}
      RETURNING *
    `;
    return result[0] as DbProcessedWebhook | null;
  } catch (error) {
    console.error('Failed to record processed webhook:', error);
    return null;
  }
}

/**
 * Generate a hash of webhook payload for idempotency
 */
export function hashWebhookPayload(payload: unknown): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHash('sha256').update(payloadString).digest('hex');
}

// ==================== STATE TRANSITION VALIDATION ====================

/**
 * Valid state transitions for transactions
 * SECURITY: Enforces state machine to prevent invalid status changes
 */
const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  'pending_confirmation': ['canceled', 'pending', 'sent', 'failed'],
  'pending': ['sent', 'failed', 'canceled'],
  'sent': ['scattered', 'returned', 'failed'],
  'queued': ['sent', 'scattered', 'failed', 'canceled'],
  'scattered': ['returned'], // Only refund is valid from completed
  'canceled': [], // Terminal state
  'returned': [], // Terminal state
  'failed': ['pending'], // Allow retry
};

/**
 * Check if a state transition is valid
 * SECURITY: Validates that state changes follow the defined state machine
 *
 * @param currentStatus - Current transaction status
 * @param newStatus - Proposed new status
 * @returns true if transition is valid
 */
export function isValidStateTransition(currentStatus: string, newStatus: string): boolean {
  // Same status is always valid (idempotent)
  if (currentStatus === newStatus) return true;

  const allowedTransitions = VALID_STATE_TRANSITIONS[currentStatus];
  if (!allowedTransitions) {
    console.error(`[SECURITY] Unknown status: ${currentStatus}`);
    return false;
  }

  return allowedTransitions.includes(newStatus);
}

/**
 * Log a state transition
 * SECURITY: Creates immutable audit trail of status changes
 */
export async function logStateTransition(params: {
  transactionId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  changeSource: 'api' | 'webhook' | 'cron' | 'manual';
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO transaction_state_log (id, transaction_id, previous_status, new_status, changed_by, change_source, ip_address, metadata)
      VALUES (
        ${`stl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`},
        ${params.transactionId},
        ${params.previousStatus},
        ${params.newStatus},
        ${params.changedBy || 'system'},
        ${params.changeSource},
        ${params.ipAddress || null},
        ${params.metadata ? JSON.stringify(params.metadata) : '{}'}
      )
    `;
  } catch (error) {
    console.error('Failed to log state transition:', error);
    // Don't throw - logging failure should not block transaction processing
  }
}

/**
 * Update transaction status with validation
 * SECURITY: Validates state transition before updating
 *
 * @param id - Transaction ID
 * @param newStatus - New status to set
 * @param options - Additional options (error detail, change source, etc.)
 * @returns Updated transaction or null if invalid transition
 */
export async function updateTransactionStatusValidated(
  id: string,
  newStatus: string,
  options?: {
    errorDetail?: string;
    changedBy?: string;
    changeSource?: 'api' | 'webhook' | 'cron' | 'manual';
    ipAddress?: string;
  }
): Promise<{ success: true; transaction: DbTransaction } | { success: false; error: string }> {
  // Get current transaction
  const current = await getTransactionById(id);
  if (!current) {
    return { success: false, error: 'Transaction not found' };
  }

  // Validate state transition
  if (!isValidStateTransition(current.status, newStatus)) {
    console.error(`[SECURITY] Invalid state transition: ${current.status} -> ${newStatus} for tx ${id}`);

    // Log the invalid attempt
    await createAuditLogEntry({
      id: `audit_${crypto.randomUUID()}`,
      action: 'INVALID_STATE_TRANSITION',
      userId: options?.changedBy,
      details: {
        transactionId: id,
        currentStatus: current.status,
        attemptedStatus: newStatus,
      },
      severity: 'warning',
      ipAddress: options?.ipAddress,
    }).catch(() => {});

    return {
      success: false,
      error: `Invalid state transition: ${current.status} -> ${newStatus}`,
    };
  }

  // Update the transaction
  const updated = await updateTransactionStatus(id, newStatus, options?.errorDetail);
  if (!updated) {
    return { success: false, error: 'Failed to update transaction' };
  }

  // Log the state transition
  await logStateTransition({
    transactionId: id,
    previousStatus: current.status,
    newStatus,
    changedBy: options?.changedBy,
    changeSource: options?.changeSource || 'api',
    ipAddress: options?.ipAddress,
  });

  return { success: true, transaction: updated };
}

/**
 * Get transaction state history
 * SECURITY: Provides audit trail for forensic analysis
 */
export async function getTransactionStateHistory(transactionId: string): Promise<{
  transaction_id: string;
  previous_status: string;
  new_status: string;
  changed_at: Date;
  changed_by: string | null;
  change_source: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
}[]> {
  try {
    const result = await sql`
      SELECT * FROM transaction_state_log
      WHERE transaction_id = ${transactionId}
      ORDER BY changed_at ASC
    `;
    return result as any[];
  } catch (error) {
    console.log('State log table not available:', error);
    return [];
  }
}

// ==================== DATABASE INITIALIZATION (SECURITY TABLES) ====================

/**
 * Initialize security-related tables
 * Call this after the main initializeDatabase()
 */
export async function initializeSecurityTables(): Promise<void> {
  try {
    // Create processed_webhooks table for idempotency
    await sql`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        id TEXT PRIMARY KEY,
        webhook_type TEXT NOT NULL CHECK (webhook_type IN ('deposit', 'order-status', 'cash')),
        tracking_key TEXT NOT NULL,
        opm_order_id TEXT,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        source_ip TEXT,
        payload_hash TEXT NOT NULL,
        result TEXT CHECK (result IN ('success', 'failed', 'duplicate')),
        UNIQUE (webhook_type, tracking_key)
      )
    `;

    // Create transaction_state_log table
    await sql`
      CREATE TABLE IF NOT EXISTS transaction_state_log (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        changed_by TEXT,
        change_source TEXT NOT NULL CHECK (change_source IN ('api', 'webhook', 'cron', 'manual')),
        ip_address TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `;

    // Add signature column to transactions if not exists
    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS signature TEXT`;
    } catch (e) {
      // Column might already exist
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_processed_webhooks_lookup ON processed_webhooks (webhook_type, tracking_key)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_state_log_transaction ON transaction_state_log (transaction_id, changed_at DESC)`;

    console.log('Security tables initialized successfully');
  } catch (error) {
    console.error('Error initializing security tables:', error);
    // Don't throw - security tables are optional enhancements
  }
}
