import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/transactions
 *
 * List transactions with advanced filters
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
    const itemsPerPage = parseInt(searchParams.get('itemsPerPage') || '50');
    const offset = (page - 1) * itemsPerPage;

    // Build WHERE conditions dynamically
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(type);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (clabeAccountId) {
      conditions.push(`clabe_account_id = $${paramIndex++}`);
      values.push(clabeAccountId);
    }

    if (from) {
      conditions.push(`created_at >= to_timestamp($${paramIndex++}::bigint / 1000.0)`);
      values.push(parseInt(from));
    }

    if (to) {
      conditions.push(`created_at <= to_timestamp($${paramIndex++}::bigint / 1000.0)`);
      values.push(parseInt(to));
    }

    if (minAmount) {
      conditions.push(`amount >= $${paramIndex++}`);
      values.push(parseFloat(minAmount));
    }

    if (maxAmount) {
      conditions.push(`amount <= $${paramIndex++}`);
      values.push(parseFloat(maxAmount));
    }

    if (beneficiaryAccount) {
      conditions.push(`beneficiary_account LIKE $${paramIndex++}`);
      values.push(`%${beneficiaryAccount}%`);
    }

    if (payerAccount) {
      conditions.push(`payer_account LIKE $${paramIndex++}`);
      values.push(`%${payerAccount}%`);
    }

    if (beneficiaryBank) {
      conditions.push(`beneficiary_bank = $${paramIndex++}`);
      values.push(beneficiaryBank);
    }

    if (payerBank) {
      conditions.push(`payer_bank = $${paramIndex++}`);
      values.push(payerBank);
    }

    if (search) {
      conditions.push(`(
        tracking_key ILIKE $${paramIndex} OR
        beneficiary_name ILIKE $${paramIndex} OR
        payer_name ILIKE $${paramIndex} OR
        concept ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const countResult = await sql.unsafe(countQuery, values);
    const total = parseInt(countResult[0]?.count || '0');

    // Get transactions with pagination
    const dataQuery = `
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
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(itemsPerPage, offset);

    const transactions = await sql.unsafe(dataQuery, values);

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

    // Calculate summary stats
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN type = 'incoming' THEN amount ELSE 0 END), 0) as total_incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' THEN amount ELSE 0 END), 0) as total_outgoing,
        COALESCE(SUM(CASE WHEN status = 'pending' OR status = 'sent' THEN amount ELSE 0 END), 0) as in_transit
      FROM transactions
      ${whereClause}
    `;
    const statsResult = await sql.unsafe(statsQuery, values.slice(0, -2)); // Remove pagination params

    const stats = {
      totalCount: parseInt(statsResult[0]?.total_count || '0'),
      totalIncoming: parseFloat(statsResult[0]?.total_incoming || '0'),
      totalOutgoing: parseFloat(statsResult[0]?.total_outgoing || '0'),
      inTransit: parseFloat(statsResult[0]?.in_transit || '0'),
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
