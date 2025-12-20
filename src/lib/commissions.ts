import crypto from 'crypto';
import {
  DbTransaction,
  DbCompany,
  getCompanyById,
  getClabeAccountById,
  createTransaction,
  createPendingCommission,
  getPendingCommissionsGroupedByCompany,
  createCommissionCutoff,
  markCommissionsAsProcessed,
  markCommissionsAsFailed,
  updateCommissionCutoffStatus,
} from './db';
// Note: In production, you would import createSpeiOutOrder from './opm-api' for actual SPEI transfers

/**
 * Commission processing module
 *
 * Handles automatic commission calculation and daily cutoff transfer to parent account (cuenta madre/integradora)
 * Instead of creating micro SPEIs for each incoming transaction, commissions are accumulated
 * and sent as a single SPEI at the daily cutoff time (10 PM)
 */

export interface CommissionResult {
  success: boolean;
  commissionAmount: number;
  pendingCommissionId?: string;
  error?: string;
}

/**
 * Calculate commission amount for a transaction
 * SECURITY FIX: Use integer arithmetic to avoid floating point precision errors
 */
export function calculateCommission(amount: number, percentage: number): number {
  if (percentage <= 0 || percentage > 100) {
    return 0;
  }
  // SECURITY FIX: Convert to cents (integer) to avoid floating point errors
  // e.g., 0.1 + 0.2 !== 0.3 in IEEE 754 floating point
  const amountCents = Math.round(amount * 100);
  const percentageBasisPoints = Math.round(percentage * 100); // 1% = 100 basis points
  // Calculate in integer space, then convert back
  const commissionCents = Math.round((amountCents * percentageBasisPoints) / 10000);
  return commissionCents / 100;
}

/**
 * Process commission for an incoming transaction
 * Creates a pending commission record that will be processed at the daily cutoff (10 PM)
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

    // Create pending commission record (will be processed at daily cutoff - 10 PM)
    const pendingCommissionId = `pc_${crypto.randomUUID()}`;

    await createPendingCommission({
      id: pendingCommissionId,
      companyId: company.id,
      sourceTransactionId: transaction.id,
      amount: commissionAmount,
      percentage: commissionPercentage,
    });

    console.log(`Pending commission created: ${pendingCommissionId}`, {
      originalTx: transaction.tracking_key,
      amount: commissionAmount,
      percentage: commissionPercentage,
      targetClabe: company.parent_clabe,
      note: 'Will be processed at daily cutoff (10 PM)',
    });

    return {
      success: true,
      commissionAmount,
      pendingCommissionId,
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
 * Daily cutoff result for a single company
 */
export interface CutoffResult {
  companyId: string;
  success: boolean;
  cutoffId?: string;
  totalAmount: number;
  commissionCount: number;
  transactionId?: string;
  trackingKey?: string;
  error?: string;
}

/**
 * Process daily commission cutoff
 * This should be called at 10 PM to process all pending commissions
 * Groups commissions by company and sends a single SPEI to each company's parent CLABE
 */
export async function processDailyCommissionCutoff(): Promise<{
  success: boolean;
  results: CutoffResult[];
  totalProcessed: number;
  totalAmount: number;
}> {
  const results: CutoffResult[] = [];
  let totalProcessed = 0;
  let totalAmount = 0;

  try {
    // Get pending commissions grouped by company
    const groupedCommissions = await getPendingCommissionsGroupedByCompany();

    if (groupedCommissions.length === 0) {
      console.log('No pending commissions to process at cutoff');
      return { success: true, results: [], totalProcessed: 0, totalAmount: 0 };
    }

    console.log(`Processing daily cutoff for ${groupedCommissions.length} companies`);

    for (const group of groupedCommissions) {
      const result = await processCompanyCutoff(group);
      results.push(result);

      if (result.success) {
        totalProcessed += result.commissionCount;
        totalAmount += result.totalAmount;
      }
    }

    return {
      success: true,
      results,
      totalProcessed,
      totalAmount,
    };
  } catch (error) {
    console.error('Daily cutoff processing error:', error);
    return {
      success: false,
      results,
      totalProcessed,
      totalAmount,
    };
  }
}

/**
 * Process cutoff for a single company
 */
async function processCompanyCutoff(group: {
  companyId: string;
  totalAmount: number;
  count: number;
  commissionIds: string[];
}): Promise<CutoffResult> {
  try {
    // Get company details
    const company = await getCompanyById(group.companyId);
    if (!company) {
      return {
        companyId: group.companyId,
        success: false,
        totalAmount: group.totalAmount,
        commissionCount: group.count,
        error: 'Company not found',
      };
    }

    if (!company.parent_clabe) {
      // Mark as failed since there's no target CLABE
      await markCommissionsAsFailed(group.commissionIds);
      return {
        companyId: group.companyId,
        success: false,
        totalAmount: group.totalAmount,
        commissionCount: group.count,
        error: 'No parent CLABE configured',
      };
    }

    // Round total amount to 2 decimal places
    const roundedAmount = Math.round(group.totalAmount * 100) / 100;

    // Create cutoff record
    const cutoffId = `cutoff_${crypto.randomUUID()}`;
    const cutoff = await createCommissionCutoff({
      id: cutoffId,
      companyId: group.companyId,
      targetClabe: company.parent_clabe,
      totalAmount: roundedAmount,
      commissionCount: group.count,
      cutoffDate: new Date(),
    });

    // Mark commissions as processing
    await markCommissionsAsProcessed(group.commissionIds, cutoffId);

    // Create the consolidated commission transaction
    // SECURITY FIX: Use crypto.randomBytes for secure tracking key
    const trackingKey = `CUTOFF${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`.substring(0, 30);
    const transactionId = `tx_cutoff_${Date.now()}`;
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const transaction = await createTransaction({
      id: transactionId,
      type: 'outgoing',
      status: 'pending',
      amount: roundedAmount,
      concept: `CORTE COMISIONES ${today} (${group.count} ops)`,
      trackingKey,
      beneficiaryAccount: company.parent_clabe,
      beneficiaryName: 'NOVACORP INTEGRADORA',
    });

    // Update cutoff with transaction info
    await updateCommissionCutoffStatus(cutoffId, 'processing', {
      transactionId,
      trackingKey,
    });

    console.log(`Cutoff processed for company ${group.companyId}:`, {
      cutoffId,
      transactionId,
      trackingKey,
      amount: roundedAmount,
      commissionCount: group.count,
      targetClabe: company.parent_clabe,
    });

    // In production, here you would:
    // 1. Send the actual SPEI via OPM API
    // 2. Update the cutoff status to 'sent' or 'failed' based on result
    //
    // try {
    //   await createSpeiOutOrder({
    //     concept: `CORTE COMISIONES ${today}`,
    //     beneficiaryAccount: company.parent_clabe,
    //     beneficiaryBank: company.parent_clabe.substring(0, 3),
    //     beneficiaryName: 'NOVACORP INTEGRADORA',
    //     amount: roundedAmount,
    //     trackingKey,
    //   });
    //   await updateCommissionCutoffStatus(cutoffId, 'sent');
    // } catch (error) {
    //   await updateCommissionCutoffStatus(cutoffId, 'failed', { errorDetail: error.message });
    // }

    return {
      companyId: group.companyId,
      success: true,
      cutoffId,
      totalAmount: roundedAmount,
      commissionCount: group.count,
      transactionId,
      trackingKey,
    };
  } catch (error) {
    console.error(`Error processing cutoff for company ${group.companyId}:`, error);
    return {
      companyId: group.companyId,
      success: false,
      totalAmount: group.totalAmount,
      commissionCount: group.count,
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
