import { neon } from '@neondatabase/serverless';

// Create a SQL client
const sql = neon(process.env.DATABASE_URL!);

export { sql };

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  company_id: string | null;
  permissions: string[];
  avatar: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface DbUserClabeAccess {
  user_id: string;
  clabe_account_id: string;
  created_at: Date;
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
}): Promise<DbCompany> {
  const result = await sql`
    INSERT INTO companies (id, name, business_name, rfc, email, phone, address, is_active)
    VALUES (${company.id}, ${company.name}, ${company.businessName}, ${company.rfc}, ${company.email}, ${company.phone || null}, ${company.address || null}, ${company.isActive ?? true})
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

export async function createUser(user: {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  companyId?: string;
  permissions: string[];
  isActive?: boolean;
}): Promise<DbUser> {
  const result = await sql`
    INSERT INTO users (id, email, password, name, role, company_id, permissions, is_active)
    VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role}, ${user.companyId || null}, ${user.permissions}, ${user.isActive ?? true})
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
    SELECT * FROM users ORDER BY created_at DESC
  `;
  return result as DbUser[];
}

export async function getUsersByCompanyId(companyId: string): Promise<DbUser[]> {
  const result = await sql`
    SELECT * FROM users WHERE company_id = ${companyId} ORDER BY created_at DESC
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
  const result = await sql`
    UPDATE users
    SET email = COALESCE(${updates.email}, email),
        password = COALESCE(${updates.password}, password),
        name = COALESCE(${updates.name}, name),
        role = COALESCE(${updates.role}, role),
        company_id = COALESCE(${updates.companyId}, company_id),
        permissions = COALESCE(${updates.permissions}, permissions),
        is_active = COALESCE(${updates.isActive}, is_active),
        last_login = COALESCE(${updates.lastLogin}, last_login),
        updated_at = CURRENT_TIMESTAMP
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
    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
}

// ==================== SESSION OPERATIONS ====================

export async function createSession(session: {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  await sql`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (${session.id}, ${session.userId}, ${session.token}, ${session.expiresAt})
  `;
}

export async function getSessionByToken(token: string): Promise<{
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
} | null> {
  const result = await sql`
    SELECT * FROM sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP
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

// ==================== HELPER FUNCTIONS ====================

// Get user with company and clabe accounts populated
export async function getUserWithRelations(id: string): Promise<{
  user: DbUser;
  company: DbCompany | null;
  clabeAccounts: DbClabeAccount[];
} | null> {
  const user = await getUserById(id);
  if (!user) return null;

  let company: DbCompany | null = null;
  let clabeAccounts: DbClabeAccount[] = [];

  if (user.company_id) {
    company = await getCompanyById(user.company_id);
  }

  // Get CLABE accounts based on role
  if (user.role === 'super_admin') {
    // Super admin has access to all CLABE accounts
    clabeAccounts = await getAllClabeAccounts();
  } else if (user.role === 'company_admin' && user.company_id) {
    // Company admin has access to all CLABE accounts in their company
    clabeAccounts = await getClabeAccountsByCompanyId(user.company_id);
  } else {
    // Regular user has access only to assigned CLABE accounts
    clabeAccounts = await getClabeAccountsForUser(id);
  }

  return { user, company, clabeAccounts };
}
