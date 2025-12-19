import { NextRequest, NextResponse } from 'next/server';
import { pool, getUserById, getClabeAccountsForUser, getClabeAccountsByCompanyId, getUserClabeAccess } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * GET /api/transactions
 *
 * List transactions with advanced filters (filtered by user's CLABE access)
 *
 * Query parameters:
 * - type: 'incoming' | 'outgoing' (filter by transaction type)
 * - status: string (filter by status: pending, sent, scattered, returned, canceled)
 * - clabeAccountId: string (filter by CLABE account ID)
 * - from: number (start date in epoch milliseconds)
 * - to: number (end date in epoch milliseconds)
 * - minAmount: number (minimum amount)
 * - maxAmount: number (maximum amount)
 * - beneficiaryAccount: string (filter by beneficiary CLABE)
 * - payerAccount: string (filter by payer CLABE)
 * - beneficiaryBank: string (filter by beneficiary bank code)
 * - payerBank: string (filter by payer bank code)
 * - search: string (search in name, concept, tracking key)
 * - page: number (page number, default 1)
 * - itemsPerPage: number (items per page, default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // SECURITY FIX: Use proper authentication instead of trusting x-user-id header
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }
    const currentUser = authResult.user;

    // Get allowed CLABE account IDs for this user
    let allowedClabeIds: string[] = [];

    if (currentUser.role === 'super_admin') {
      // Super admin can see all - no filter needed
      allowedClabeIds = []; // Empty means no filter
    } else if (currentUser.role === 'company_admin' && currentUser.companyId) {
      // Company admin sees all CLABEs from their company
      const companyClabes = await getClabeAccountsByCompanyId(currentUser.companyId);
      allowedClabeIds = companyClabes.map(c => c.id);
    } else {
      // Regular user sees only assigned CLABEs
      allowedClabeIds = await getUserClabeAccess(currentUser.id);
    }

    // If user is not super_admin and has no CLABEs assigned, return empty result
    if (currentUser.role !== 'super_admin' && allowedClabeIds.length === 0) {
      return NextResponse.json({
        transactions: [],
        pagination: { page: 1, itemsPerPage: 50, total: 0, totalPages: 0 },
        stats: { totalCount: 0, totalIncoming: 0, totalOutgoing: 0, inTransit: 0, settledIncoming: 0, settledOutgoing: 0 },
      });
    }

    // Extract query parameters
    const type = searchParams.get('type') as 'incoming' | 'outgoing' | null;
    const status = searchParams.get('status');
    const clabeAccountId = searchParams.get('clabeAccountId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const beneficiaryAccount = searchParams.get('beneficiaryAccount');
    const payerAccount = searchParams.get('payerAccount');
    const beneficiaryBank = searchParams.get('beneficiaryBank');
    const payerBank = searchParams.get('payerBank');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const itemsPerPage = Math.min(parseInt(searchParams.get('itemsPerPage') || '50'), 100);
    const offset = (page - 1) * itemsPerPage;

    // Build dynamic WHERE clause
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    // CRITICAL: Filter by allowed CLABEs for non-super_admin users
    if (currentUser && currentUser.role !== 'super_admin' && allowedClabeIds.length > 0) {
      const placeholders = allowedClabeIds.map((_, i) => `$${paramIndex + i}`).join(',');
      conditions.push(`clabe_account_id IN (${placeholders})`);
      params.push(...allowedClabeIds);
      paramIndex += allowedClabeIds.length;
    }

    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(type);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (clabeAccountId) {
      conditions.push(`clabe_account_id = $${paramIndex++}`);
      params.push(clabeAccountId);
    }

    if (from) {
      const fromDate = new Date(parseInt(from));
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(fromDate);
    }

    if (to) {
      const toDate = new Date(parseInt(to));
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(toDate);
    }

    if (minAmount) {
      conditions.push(`amount >= $${paramIndex++}`);
      params.push(parseFloat(minAmount));
    }

    if (maxAmount) {
      conditions.push(`amount <= $${paramIndex++}`);
      params.push(parseFloat(maxAmount));
    }

    if (beneficiaryAccount) {
      conditions.push(`beneficiary_account LIKE $${paramIndex++}`);
      params.push(`%${beneficiaryAccount}%`);
    }

    if (payerAccount) {
      conditions.push(`payer_account LIKE $${paramIndex++}`);
      params.push(`%${payerAccount}%`);
    }

    if (beneficiaryBank) {
      conditions.push(`beneficiary_bank = $${paramIndex++}`);
      params.push(beneficiaryBank);
    }

    if (payerBank) {
      conditions.push(`payer_bank = $${paramIndex++}`);
      params.push(payerBank);
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(`(
        tracking_key ILIKE $${paramIndex} OR
        beneficiary_name ILIKE $${paramIndex} OR
        payer_name ILIKE $${paramIndex} OR
        concept ILIKE $${paramIndex}
      )`);
      paramIndex++;
      params.push(searchPattern);
    }

    const whereClause = conditions.join(' AND ');

    // Main query for transactions
    const transactionsQuery = `
      SELECT
        id,
        clabe_account_id,
        type,
        status,
        amount,
        concept,
        tracking_key,
        numerical_reference,
        beneficiary_account,
        beneficiary_bank,
        beneficiary_name,
        beneficiary_uid,
        payer_account,
        payer_bank,
        payer_name,
        payer_uid,
        opm_order_id,
        error_detail,
        cep_url,
        created_at,
        updated_at,
        settled_at
      FROM transactions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const transactionsParams = [...params, itemsPerPage, offset];
    const transactionsResult = await pool.query(transactionsQuery, transactionsParams);
    const transactions = transactionsResult.rows;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as count
      FROM transactions
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Stats query - in_transit only counts outgoing transactions that haven't settled
    // Note: pending_confirmation = during 20-second grace period (can still cancel)
    // settled_incoming = incoming transactions that are fully settled (scattered)
    // settled_outgoing = outgoing transactions that are sent or settled (reduces available balance)
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN type = 'incoming' THEN amount ELSE 0 END), 0) as total_incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' THEN amount ELSE 0 END), 0) as total_outgoing,
        COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('pending_confirmation', 'pending', 'sent', 'queued') THEN amount ELSE 0 END), 0) as in_transit,
        COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as settled_incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as settled_outgoing
      FROM transactions
      WHERE ${whereClause}
    `;
    const statsResult = await pool.query(statsQuery, params);

    // Transform to frontend format
    const formattedTransactions = transactions.map((tx: any) => ({
      id: tx.id,
      clabeAccountId: tx.clabe_account_id,
      type: tx.type,
      status: tx.status,
      amount: parseFloat(tx.amount),
      concept: tx.concept,
      trackingKey: tx.tracking_key,
      numericalReference: tx.numerical_reference,
      beneficiaryAccount: tx.beneficiary_account,
      beneficiaryBank: tx.beneficiary_bank,
      beneficiaryName: tx.beneficiary_name,
      beneficiaryUid: tx.beneficiary_uid,
      payerAccount: tx.payer_account,
      payerBank: tx.payer_bank,
      payerName: tx.payer_name,
      payerUid: tx.payer_uid,
      opmOrderId: tx.opm_order_id,
      errorDetail: tx.error_detail,
      cepUrl: tx.cep_url,
      createdAt: new Date(tx.created_at).getTime(),
      updatedAt: new Date(tx.updated_at).getTime(),
      settledAt: tx.settled_at ? new Date(tx.settled_at).getTime() : null,
    }));

    const stats = {
      totalCount: parseInt(statsResult.rows[0]?.total_count || '0'),
      totalIncoming: parseFloat(statsResult.rows[0]?.total_incoming || '0'),
      totalOutgoing: parseFloat(statsResult.rows[0]?.total_outgoing || '0'),
      inTransit: parseFloat(statsResult.rows[0]?.in_transit || '0'),
      // For calculating available balance per CLABE
      settledIncoming: parseFloat(statsResult.rows[0]?.settled_incoming || '0'),
      settledOutgoing: parseFloat(statsResult.rows[0]?.settled_outgoing || '0'),
    };

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        itemsPerPage,
        total,
        totalPages: Math.ceil(total / itemsPerPage),
      },
      stats,
    });
  } catch (error) {
    console.error('List transactions error:', error);
    return NextResponse.json(
      { error: 'Error al obtener transacciones', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
