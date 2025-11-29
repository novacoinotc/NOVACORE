import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getUserByEmail, createUser } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

export async function POST() {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Check if admin exists
    const existingAdmin = await getUserByEmail('admin@novacore.mx');

    if (!existingAdmin) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await createUser({
        id: 'admin_' + Date.now(),
        email: 'admin@novacore.mx',
        password: hashedPassword,
        name: 'Administrador',
        role: 'admin',
        permissions: [],
        isActive: true,
      });
      console.log('Admin user created');
    }

    // Check if demo user exists
    const existingUser = await getUserByEmail('usuario@novacore.mx');

    if (!existingUser) {
      // Create demo user
      const hashedPassword = await bcrypt.hash('user123', 10);
      await createUser({
        id: 'user_' + Date.now(),
        email: 'usuario@novacore.mx',
        password: hashedPassword,
        name: 'Usuario Demo',
        role: 'user',
        permissions: DEFAULT_ROLE_PERMISSIONS.user,
        isActive: true,
      });
      console.log('Demo user created');
    }

    return NextResponse.json({
      success: true,
      message: 'Base de datos inicializada correctamente',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Error al inicializar la base de datos', details: String(error) },
      { status: 500 }
    );
  }
}
