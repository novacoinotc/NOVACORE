const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // SECURITY: Password must be provided via environment variable
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (!password || password.length < 12) {
      console.error('❌ ERROR: INITIAL_ADMIN_PASSWORD environment variable is required');
      console.error('   Password must be at least 12 characters long');
      console.error('   Usage: INITIAL_ADMIN_PASSWORD="YourSecurePassword123!" node create-admin.js');
      process.exit(1);
    }

    // SECURITY: Use bcrypt with 12 rounds (not 10)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario administrador
    const admin = await prisma.user.create({
      data: {
        email: 'admin@novacorp.mx',
        password: hashedPassword,
        name: 'Administrador Principal',
        role: 'admin',
        permissions: ['all'],
        isActive: true,
      },
    });

    console.log('✅ Usuario administrador creado exitosamente:');
    console.log('Email:', admin.email);
    console.log('Nombre:', admin.name);
    console.log('\n⚠️  IMPORTANTE: Cambia esta contraseña después del primer login');

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('❌ El email ya existe en la base de datos');
    } else {
      console.error('Error al crear administrador:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
