const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('Admin2024!Secure', 10);

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
    console.log('Contraseña: Admin2024!Secure');
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
