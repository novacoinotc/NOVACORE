/**
 * Script to create super admin user
 * Run with: node scripts/create-super-admin.js
 */

const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
  }
}

loadEnv();

const sql = neon(process.env.DATABASE_URL);

const DEFAULT_SUPER_ADMIN_PERMISSIONS = [
  'dashboard.view',
  'transfers.view',
  'transfers.create',
  'transfers.approve',
  'history.view',
  'history.export',
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'companies.view',
  'companies.create',
  'companies.edit',
  'companies.delete',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'clabe.view',
  'clabe.create',
  'clabe.edit',
  'clabe.delete',
  'settings.view',
  'settings.edit',
  'reports.view',
  'reports.export',
  'webhooks.view',
  'webhooks.manage',
  'api.access',
];

async function createSuperAdmin() {
  const email = 'direccion@novacorp.mx';
  const name = 'Director General';

  // SECURITY: Password must be provided via environment variable
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    console.error('❌ ERROR: SUPER_ADMIN_PASSWORD environment variable is required');
    console.error('   Password must be at least 12 characters long');
    console.error('   Usage: SUPER_ADMIN_PASSWORD="YourSecurePassword123!" node scripts/create-super-admin.js');
    process.exit(1);
  }

  try {
    console.log('🔄 Checking if user exists...');

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existing.length > 0) {
      console.log('⚠️  User already exists, updating password...');

      // SECURITY: Use bcrypt with 12 rounds (not 10)
      const hashedPassword = await bcrypt.hash(password, 12);
      await sql`
        UPDATE users
        SET password = ${hashedPassword},
            role = 'super_admin',
            is_active = true,
            permissions = ${DEFAULT_SUPER_ADMIN_PERMISSIONS},
            updated_at = CURRENT_TIMESTAMP
        WHERE email = ${email}
      `;

      console.log('✅ User updated successfully!');
    } else {
      console.log('🔄 Creating new super admin user...');

      // SECURITY: Use bcrypt with 12 rounds (not 10)
      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = `super_admin_${Date.now()}`;

      // Create user
      await sql`
        INSERT INTO users (id, email, password, name, role, permissions, is_active)
        VALUES (${userId}, ${email}, ${hashedPassword}, ${name}, 'super_admin', ${DEFAULT_SUPER_ADMIN_PERMISSIONS}, true)
      `;

      console.log('✅ Super admin created successfully!');
    }

    console.log('\n📧 Email:', email);
    console.log('🔐 Password: [provided via environment variable]');
    console.log('👤 Role: super_admin');
    console.log('\n🎉 You can now login at https://novacorp.mx/login');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
