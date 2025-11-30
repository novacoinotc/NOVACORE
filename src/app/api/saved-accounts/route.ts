import { NextRequest, NextResponse } from 'next/server';
import {
  getSavedAccountsByUserId,
  createSavedAccount,
  getSavedAccountByUserAndClabe,
  getUserById
} from '@/lib/db';
import { SavedAccount } from '@/types';

// Helper to get current user from request headers
async function getCurrentUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return null;
  return await getUserById(userId);
}

// Transform DB saved account to frontend format
function transformSavedAccount(dbSavedAccount: any): SavedAccount {
  return {
    id: dbSavedAccount.id,
    userId: dbSavedAccount.user_id,
    alias: dbSavedAccount.alias,
    clabe: dbSavedAccount.clabe,
    bankCode: dbSavedAccount.bank_code,
    bankName: dbSavedAccount.bank_name,
    beneficiaryName: dbSavedAccount.beneficiary_name,
    beneficiaryRfc: dbSavedAccount.beneficiary_rfc,
    accountType: dbSavedAccount.account_type,
    notes: dbSavedAccount.notes,
    isActive: dbSavedAccount.is_active,
    createdAt: new Date(dbSavedAccount.created_at).getTime(),
    updatedAt: new Date(dbSavedAccount.updated_at).getTime(),
  };
}

// GET /api/saved-accounts - Get saved accounts for the current user
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Each user only sees their own saved accounts
    const dbSavedAccounts = await getSavedAccountsByUserId(currentUser.id);
    const savedAccounts = dbSavedAccounts.map(transformSavedAccount);

    return NextResponse.json(savedAccounts);
  } catch (error) {
    console.error('Get saved accounts error:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas guardadas' },
      { status: 500 }
    );
  }
}

// POST /api/saved-accounts - Create a new saved account
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { alias, clabe, bankCode, bankName, beneficiaryName, beneficiaryRfc, accountType, notes } = body;

    // Validation
    if (!alias || !clabe || !bankCode || !bankName || !beneficiaryName) {
      return NextResponse.json(
        { error: 'Alias, CLABE, código de banco, nombre del banco y nombre del beneficiario son requeridos' },
        { status: 400 }
      );
    }

    // Validate CLABE format (18 digits)
    if (!/^\d{18}$/.test(clabe)) {
      return NextResponse.json(
        { error: 'La CLABE debe tener exactamente 18 dígitos' },
        { status: 400 }
      );
    }

    // Check if the user already has this CLABE saved
    const existingAccount = await getSavedAccountByUserAndClabe(currentUser.id, clabe);
    if (existingAccount) {
      return NextResponse.json(
        { error: 'Ya tienes esta cuenta CLABE guardada' },
        { status: 400 }
      );
    }

    // Create the saved account
    const dbSavedAccount = await createSavedAccount({
      id: 'saved_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      userId: currentUser.id,
      alias,
      clabe,
      bankCode,
      bankName,
      beneficiaryName,
      beneficiaryRfc,
      accountType: accountType || 40,
      notes,
      isActive: true,
    });

    const savedAccount = transformSavedAccount(dbSavedAccount);

    return NextResponse.json(savedAccount, { status: 201 });
  } catch (error) {
    console.error('Create saved account error:', error);
    return NextResponse.json(
      { error: 'Error al crear cuenta guardada' },
      { status: 500 }
    );
  }
}
