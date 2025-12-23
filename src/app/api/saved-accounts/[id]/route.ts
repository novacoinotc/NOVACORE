import { NextRequest, NextResponse } from 'next/server';
import {
  getSavedAccountById,
  updateSavedAccount,
  deleteSavedAccount,
  getSavedAccountByUserAndClabe
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

// GET /api/saved-accounts/[id] - Get a specific saved account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    // SECURITY FIX: Pass userId to enforce ownership at database layer
    const dbSavedAccount = await getSavedAccountById(id, currentUser.id);

    if (!dbSavedAccount) {
      // Returns 404 whether account doesn't exist or belongs to another user
      // This prevents enumeration attacks
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    const savedAccount = transformSavedAccount(dbSavedAccount);

    return NextResponse.json(savedAccount);
  } catch (error) {
    console.error('Get saved account error:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuenta guardada' },
      { status: 500 }
    );
  }
}

// PUT /api/saved-accounts/[id] - Update a saved account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    // SECURITY FIX: Pass userId to enforce ownership at database layer
    const existingAccount = await getSavedAccountById(id, currentUser.id);

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { alias, clabe, bankCode, bankName, beneficiaryName, beneficiaryRfc, accountType, notes, isActive } = body;

    // If CLABE is being changed, validate it
    if (clabe && clabe !== existingAccount.clabe) {
      // Validate CLABE format (18 digits)
      if (!/^\d{18}$/.test(clabe)) {
        return NextResponse.json(
          { error: 'La CLABE debe tener exactamente 18 dígitos' },
          { status: 400 }
        );
      }

      // Check if the user already has this CLABE saved
      const duplicateAccount = await getSavedAccountByUserAndClabe(currentUser.id, clabe);
      if (duplicateAccount && duplicateAccount.id !== id) {
        return NextResponse.json(
          { error: 'Ya tienes esta cuenta CLABE guardada' },
          { status: 400 }
        );
      }
    }

    // SECURITY FIX: Pass userId to enforce ownership at database layer
    const dbSavedAccount = await updateSavedAccount(id, currentUser.id, {
      alias,
      clabe,
      bankCode,
      bankName,
      beneficiaryName,
      beneficiaryRfc,
      accountType,
      notes,
      isActive,
    });

    if (!dbSavedAccount) {
      return NextResponse.json(
        { error: 'Error al actualizar cuenta guardada' },
        { status: 500 }
      );
    }

    const savedAccount = transformSavedAccount(dbSavedAccount);

    return NextResponse.json(savedAccount);
  } catch (error) {
    console.error('Update saved account error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cuenta guardada' },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-accounts/[id] - Delete a saved account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    // SECURITY FIX: Pass userId to enforce ownership at database layer
    const deleted = await deleteSavedAccount(id, currentUser.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Cuenta guardada eliminada correctamente' });
  } catch (error) {
    console.error('Delete saved account error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta guardada' },
      { status: 500 }
    );
  }
}
