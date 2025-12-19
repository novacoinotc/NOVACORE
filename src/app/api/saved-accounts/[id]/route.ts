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
    const dbSavedAccount = await getSavedAccountById(id);

    if (!dbSavedAccount) {
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    // Users can only see their own saved accounts
    if (dbSavedAccount.user_id !== currentUser.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta cuenta guardada' },
        { status: 403 }
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
    const existingAccount = await getSavedAccountById(id);

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    // Users can only update their own saved accounts
    if (existingAccount.user_id !== currentUser.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar esta cuenta guardada' },
        { status: 403 }
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

    const dbSavedAccount = await updateSavedAccount(id, {
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
    const existingAccount = await getSavedAccountById(id);

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Cuenta guardada no encontrada' },
        { status: 404 }
      );
    }

    // Users can only delete their own saved accounts
    if (existingAccount.user_id !== currentUser.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar esta cuenta guardada' },
        { status: 403 }
      );
    }

    await deleteSavedAccount(id);

    return NextResponse.json({ success: true, message: 'Cuenta guardada eliminada correctamente' });
  } catch (error) {
    console.error('Delete saved account error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cuenta guardada' },
      { status: 500 }
    );
  }
}
