import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getSavedAccountsByUserId,
  createSavedAccount,
  getSavedAccountByUserAndClabe,
} from '@/lib/db';
import { SavedAccount } from '@/types';
import { authenticateRequest } from '@/lib/auth-middleware';

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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

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
    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

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

    // Create the saved account - SECURITY FIX: Use crypto.randomUUID() for secure ID generation
    const dbSavedAccount = await createSavedAccount({
      id: `saved_${crypto.randomUUID()}`,
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
