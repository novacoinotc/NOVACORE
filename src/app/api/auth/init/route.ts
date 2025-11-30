import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { initializeDatabase, getUserByEmail, createUser, getCompanyByRfc, createCompany } from '@/lib/db';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types';

export async function POST() {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Check if super admin exists
    const existingSuperAdmin = await getUserByEmail('admin@novacore.mx');

    if (!existingSuperAdmin) {
      // Create super admin user (no company association)
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await createUser({
        id: 'super_admin_' + Date.now(),
        email: 'admin@novacore.mx',
        password: hashedPassword,
        name: 'Super Administrador',
        role: 'super_admin',
        permissions: DEFAULT_ROLE_PERMISSIONS.super_admin,
        isActive: true,
      });
      console.log('Super admin user created');
    }

    // Check if demo company exists
    let demoCompany = await getCompanyByRfc('DEMO123456ABC');

    if (!demoCompany) {
      // Create demo company
      demoCompany = await createCompany({
        id: 'company_' + Date.now(),
        name: 'Empresa Demo',
        businessName: 'Empresa Demo S.A. de C.V.',
        rfc: 'DEMO123456ABC',
        email: 'contacto@empresademo.mx',
        phone: '5555555555',
        address: 'Av. Ejemplo 123, CDMX',
        isActive: true,
      });
      console.log('Demo company created');
    }

    // Check if company admin exists
    const existingCompanyAdmin = await getUserByEmail('empresa@novacore.mx');

    if (!existingCompanyAdmin && demoCompany) {
      // Create company admin user
      const hashedPassword = await bcrypt.hash('empresa123', 10);
      await createUser({
        id: 'company_admin_' + Date.now(),
        email: 'empresa@novacore.mx',
        password: hashedPassword,
        name: 'Admin Empresa Demo',
        role: 'company_admin',
        companyId: demoCompany.id,
        permissions: DEFAULT_ROLE_PERMISSIONS.company_admin,
        isActive: true,
      });
      console.log('Company admin user created');
    }

    // Check if demo user exists
    const existingUser = await getUserByEmail('usuario@novacore.mx');

    if (!existingUser && demoCompany) {
      // Create demo user
      const hashedPassword = await bcrypt.hash('user123', 10);
      await createUser({
        id: 'user_' + Date.now(),
        email: 'usuario@novacore.mx',
        password: hashedPassword,
        name: 'Usuario Demo',
        role: 'user',
        companyId: demoCompany.id,
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
