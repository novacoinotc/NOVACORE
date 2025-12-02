import { Pool, QueryResult } from 'pg';

// Create PostgreSQL connection pool for AWS RDS
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for AWS RDS
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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
}): Promise<DbClabeAccount> {
  const result = await sql`
    INSERT INTO clabe_accounts (id, company_id, clabe, alias, description, is_active)
    VALUES (${clabeAccount.id}, ${clabeAccount.companyId}, ${clabeAccount.clabe}, ${clabeAccount.alias}, ${clabeAccount.description || null}, ${clabeAccount.isActive ?? true})
    RETURNING *
  `;
  return result[0] as DbClabeAccount;
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
  }>
): Promise<DbClabeAccount | null> {
  const result = await sql`
    UPDATE clabe_accounts
    SET alias = COALESCE(${updates.alias}, alias),
        description = COALESCE(${updates.description}, description),
        is_active = COALESCE(${updates.isActive}, is_active),
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

// ==================== USER OPERATIONS ====================
// Note: Database uses camelCase columns (Prisma default)

export async function createUser(user: {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  permissions: string[];
  isActive?: boolean;
}): Promise<DbUser> {
  const now = new Date();
  const result = await sql`
    INSERT INTO users (id, email, password, name, role, permissions, "isActive", "createdAt", "updatedAt")
    VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role}, ${user.permissions}, ${user.isActive ?? true}, ${now}, ${now})
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
// Note: Database uses camelCase columns (Prisma default)

export async function createSession(session: {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const now = new Date();
  await sql`
    INSERT INTO sessions (id, "userId", token, "expiresAt", "createdAt")
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
    SELECT * FROM sessions WHERE token = ${token} AND "expiresAt" > CURRENT_TIMESTAMP
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
    DELETE FROM sessions WHERE "expiresAt" < CURRENT_TIMESTAMP
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
}): Promise<DbTransaction> {
  const result = await sql`
    INSERT INTO transactions (
      id, clabe_account_id, type, status, amount, concept, tracking_key,
      numerical_reference, beneficiary_account, beneficiary_bank, beneficiary_name,
      beneficiary_uid, payer_account, payer_bank, payer_name, payer_uid, opm_order_id
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
      ${transaction.opmOrderId || null}
    )
    RETURNING *
  `;
  return result[0] as DbTransaction;
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

export async function getTransactionsByClabeAccount(clabeAccountId: string): Promise<DbTransaction[]> {
  const result = await sql`
    SELECT * FROM transactions WHERE clabe_account_id = ${clabeAccountId} ORDER BY created_at DESC
  `;
  return result as DbTransaction[];
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

  // Build query dynamically (simplified - in production use a query builder)
  let whereConditions: string[] = [];

  if (params.type) whereConditions.push(`type = '${params.type}'`);
  if (params.status) whereConditions.push(`status = '${params.status}'`);
  if (params.clabeAccountId) whereConditions.push(`clabe_account_id = '${params.clabeAccountId}'`);

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countResult = await sql`
    SELECT COUNT(*) as count FROM transactions ${sql.unsafe(whereClause)}
  `;
  const total = parseInt(countResult[0]?.count || '0');

  const result = await sql`
    SELECT * FROM transactions
    ${sql.unsafe(whereClause)}
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

  let clabeFilter = '';
  if (companyId) {
    // Get all CLABE accounts for this company
    const clabes = await getClabeAccountsByCompanyId(companyId);
    if (clabes.length > 0) {
      const clabeIds = clabes.map(c => `'${c.id}'`).join(',');
      clabeFilter = `AND clabe_account_id IN (${clabeIds})`;
    } else {
      // No CLABE accounts, return empty stats
      return {
        totalIncoming: 0,
        totalOutgoing: 0,
        pendingCount: 0,
        clientsCount: 0,
        totalBalance: 0,
        incomingChange: 0,
        outgoingChange: 0,
        weeklyData: [],
      };
    }
  }

  // Current period stats
  const currentStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM transactions
    WHERE created_at >= ${thirtyDaysAgo.toISOString()}
    ${sql.unsafe(clabeFilter)}
  `;

  // Previous period stats (for comparison)
  const prevStatsResult = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
      COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
    FROM transactions
    WHERE created_at >= ${sixtyDaysAgo.toISOString()} AND created_at < ${thirtyDaysAgo.toISOString()}
    ${sql.unsafe(clabeFilter)}
  `;

  // Get unique clients count (unique payer names for incoming transactions)
  const clientsResult = await sql`
    SELECT COUNT(DISTINCT payer_name) as count
    FROM transactions
    WHERE type = 'incoming' AND payer_name IS NOT NULL
    ${sql.unsafe(clabeFilter)}
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
    ${sql.unsafe(clabeFilter)}
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

  return {
    totalIncoming: currentIncoming,
    totalOutgoing: currentOutgoing,
    pendingCount: parseInt(currentStatsResult[0]?.pending_count || '0'),
    clientsCount: parseInt(clientsResult[0]?.count || '0'),
    totalBalance: currentIncoming - currentOutgoing,
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

  const clabeIds = clabes.map(c => `'${c.id}'`).join(',');

  let whereConditions = [`clabe_account_id IN (${clabeIds})`];
  if (params?.type) whereConditions.push(`type = '${params.type}'`);
  if (params?.status) whereConditions.push(`status = '${params.status}'`);

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const countResult = await sql`
    SELECT COUNT(*) as count FROM transactions ${sql.unsafe(whereClause)}
  `;
  const total = parseInt(countResult[0]?.count || '0');

  const result = await sql`
    SELECT * FROM transactions
    ${sql.unsafe(whereClause)}
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
  clabeAccounts: DbClabeAccount[];
  stats: {
    totalIncoming: number;
    totalOutgoing: number;
    transactionCount: number;
  };
} | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;

  const users = await getUsersByCompanyId(companyId);
  const clabeAccounts = await getClabeAccountsByCompanyId(companyId);

  // Get transaction stats for this company
  const clabeIds = clabeAccounts.map(c => `'${c.id}'`).join(',');
  let stats = { totalIncoming: 0, totalOutgoing: 0, transactionCount: 0 };

  if (clabeAccounts.length > 0) {
    const statsResult = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing,
        COUNT(*) as count
      FROM transactions
      WHERE clabe_account_id IN (${sql.unsafe(clabeIds)})
    `;

    stats = {
      totalIncoming: parseFloat(statsResult[0]?.incoming || '0'),
      totalOutgoing: parseFloat(statsResult[0]?.outgoing || '0'),
      transactionCount: parseInt(statsResult[0]?.count || '0'),
    };
  }

  return { company, users, clabeAccounts, stats };
}

// Get recent transactions for dashboard
export async function getRecentTransactions(
  limit: number = 10,
  companyId?: string
): Promise<DbTransaction[]> {
  let clabeFilter = '';
  if (companyId) {
    const clabes = await getClabeAccountsByCompanyId(companyId);
    if (clabes.length > 0) {
      const clabeIds = clabes.map(c => `'${c.id}'`).join(',');
      clabeFilter = `WHERE clabe_account_id IN (${clabeIds})`;
    } else {
      return [];
    }
  }

  const result = await sql`
    SELECT * FROM transactions
    ${sql.unsafe(clabeFilter)}
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
  const trackingKey = `COM${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return createTransaction({
    id: `tx_comm_${Date.now()}`,
    type: 'outgoing',
    status: 'pending',
    amount: params.commissionAmount,
    trackingKey,
    concept: `Comisión por transacción ${params.sourceTransaction.tracking_key}`,
    beneficiaryAccount: params.targetClabe,
    beneficiaryName: 'NOVACORE INTEGRADORA',
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

  const idsPlaceholder = commissionIds.map(id => `'${id}'`).join(',');
  await sql`
    UPDATE pending_commissions
    SET status = 'processed', cutoff_id = ${cutoffId}
    WHERE id IN (${sql.unsafe(idsPlaceholder)})
  `;
}

export async function markCommissionsAsFailed(commissionIds: string[]): Promise<void> {
  if (commissionIds.length === 0) return;

  const idsPlaceholder = commissionIds.map(id => `'${id}'`).join(',');
  await sql`
    UPDATE pending_commissions
    SET status = 'failed'
    WHERE id IN (${sql.unsafe(idsPlaceholder)})
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
