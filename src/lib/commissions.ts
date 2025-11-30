import { DbTransaction, DbCompany, getCompanyById, getClabeAccountById, createTransaction } from './db';
// Note: In production, you would import createSpeiOutOrder from './opm-api' for actual SPEI transfers

/**
 * Commission processing module
 *
 * Handles automatic commission calculation and transfer to parent account (cuenta madre/integradora)
 */

export interface CommissionResult {
  success: boolean;
  commissionAmount: number;
  commissionTransactionId?: string;
  error?: string;
}

/**
 * Calculate commission amount for a transaction
 */
export function calculateCommission(amount: number, percentage: number): number {
  if (percentage <= 0 || percentage > 100) {
    return 0;
  }
  // Round to 2 decimal places
  return Math.round(amount * (percentage / 100) * 100) / 100;
}

/**
 * Process commission for an incoming transaction
 * Creates a commission transaction and optionally sends it to the parent CLABE
 */
export async function processCommission(
  transaction: DbTransaction,
  company: DbCompany
): Promise<CommissionResult> {
  try {
    // Check if company has commission configured
    const commissionPercentage = parseFloat(company.commission_percentage?.toString() || '0');
    if (commissionPercentage <= 0) {
      return { success: true, commissionAmount: 0 };
    }

    // Check if parent CLABE is configured
    if (!company.parent_clabe) {
      console.log(`Company ${company.id} has commission but no parent CLABE configured`);
      return { success: true, commissionAmount: 0 };
    }

    // Calculate commission
    const commissionAmount = calculateCommission(
      parseFloat(transaction.amount?.toString() || '0'),
      commissionPercentage
    );

    if (commissionAmount <= 0) {
      return { success: true, commissionAmount: 0 };
    }

    // Create commission transaction record
    const commissionTrackingKey = `COM${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const commissionTxId = `tx_comm_${Date.now()}`;

    const commissionTx = await createTransaction({
      id: commissionTxId,
      clabeAccountId: transaction.clabe_account_id || undefined,
      type: 'outgoing',
      status: 'pending',
      amount: commissionAmount,
      concept: `Comision ${commissionPercentage}% - ${transaction.tracking_key}`,
      trackingKey: commissionTrackingKey,
      beneficiaryAccount: company.parent_clabe,
      beneficiaryName: 'NOVACORE INTEGRADORA',
    });

    console.log(`Commission transaction created: ${commissionTxId}`, {
      originalTx: transaction.tracking_key,
      amount: commissionAmount,
      percentage: commissionPercentage,
      targetClabe: company.parent_clabe,
    });

    // In production, you would trigger the actual SPEI transfer here
    // For now, we just record the commission transaction
    // The actual transfer would be done via OPM API:
    //
    // try {
    //   await createSpeiOutOrder({
    //     concept: `Comision ${commissionPercentage}%`,
    //     beneficiaryAccount: company.parent_clabe,
    //     beneficiaryBank: company.parent_clabe.substring(0, 3), // Extract bank code
    //     beneficiaryName: 'NOVACORE INTEGRADORA',
    //     // ... other required fields
    //   });
    // } catch (error) {
    //   console.error('Failed to send commission SPEI:', error);
    // }

    return {
      success: true,
      commissionAmount,
      commissionTransactionId: commissionTxId,
    };
  } catch (error) {
    console.error('Commission processing error:', error);
    return {
      success: false,
      commissionAmount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a company can receive SPEI IN
 */
export async function canReceiveSpei(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const company = await getCompanyById(companyId);
    if (!company) {
      return { allowed: false, reason: 'Empresa no encontrada' };
    }

    if (!company.is_active) {
      return { allowed: false, reason: 'Empresa inactiva' };
    }

    if (!company.spei_in_enabled) {
      return { allowed: false, reason: 'SPEI IN deshabilitado para esta empresa' };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'Error al verificar permisos' };
  }
}

/**
 * Check if a company can send SPEI OUT
 */
export async function canSendSpei(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const company = await getCompanyById(companyId);
    if (!company) {
      return { allowed: false, reason: 'Empresa no encontrada' };
    }

    if (!company.is_active) {
      return { allowed: false, reason: 'Empresa inactiva' };
    }

    if (!company.spei_out_enabled) {
      return { allowed: false, reason: 'SPEI OUT deshabilitado para esta empresa' };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'Error al verificar permisos' };
  }
}

/**
 * Get company from CLABE account
 */
export async function getCompanyFromClabe(clabe: string): Promise<DbCompany | null> {
  try {
    const clabeAccount = await getClabeAccountById(clabe);
    if (!clabeAccount) {
      return null;
    }
    return await getCompanyById(clabeAccount.company_id);
  } catch (error) {
    return null;
  }
}
