import { neon } from '@neondatabase/serverless';

// Create a SQL client
const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        permissions TEXT[] DEFAULT '{}',
        avatar TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
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

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// User types matching our TypeScript interfaces
export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  permissions: string[];
  avatar: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

// User operations
export async function createUser(user: {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  permissions: string[];
  isActive?: boolean;
}): Promise<DbUser> {
  const result = await sql`
    INSERT INTO users (id, email, password, name, role, permissions, is_active)
    VALUES (${user.id}, ${user.email}, ${user.password}, ${user.name}, ${user.role}, ${user.permissions}, ${user.isActive ?? true})
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
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.email !== undefined) {
    setClauses.push(`email = $${values.length + 1}`);
    values.push(updates.email);
  }
  if (updates.password !== undefined) {
    setClauses.push(`password = $${values.length + 1}`);
    values.push(updates.password);
  }
  if (updates.name !== undefined) {
    setClauses.push(`name = $${values.length + 1}`);
    values.push(updates.name);
  }
  if (updates.role !== undefined) {
    setClauses.push(`role = $${values.length + 1}`);
    values.push(updates.role);
  }
  if (updates.permissions !== undefined) {
    setClauses.push(`permissions = $${values.length + 1}`);
    values.push(updates.permissions);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${values.length + 1}`);
    values.push(updates.isActive);
  }
  if (updates.lastLogin !== undefined) {
    setClauses.push(`last_login = $${values.length + 1}`);
    values.push(updates.lastLogin);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');

  if (setClauses.length === 1) return getUserById(id);

  // Use template literal for the query
  const result = await sql`
    UPDATE users
    SET email = COALESCE(${updates.email}, email),
        password = COALESCE(${updates.password}, password),
        name = COALESCE(${updates.name}, name),
        role = COALESCE(${updates.role}, role),
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
  const result = await sql`
    DELETE FROM users WHERE id = ${id}
  `;
  return true;
}

export async function updateLastLogin(id: string): Promise<void> {
  await sql`
    UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ${id}
  `;
}

// Session operations
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
