/**
 * OPM Transaction Synchronization Script
 *
 * This script synchronizes transactions between OPM and the local database.
 * It fetches transactions from OPM API and ensures they exist in the local DB
 * with the correct status.
 *
 * Usage: npm run sync-opm
 *
 * Environment variables required:
 * - OPM_API_KEY: API key for OPM
 * - OPM_DEFAULT_ACCOUNT: Default CLABE account to sync
 * - DATABASE_URL: PostgreSQL connection string
 */

// Load environment variables FIRST (before any other imports that use env vars)
import { config } from 'dotenv';
import { resolve } from 'path';

// Load from project root .env files
config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

// Now import modules that depend on environment variables
import { listOrders, getBalance, ListOrdersParams } from '@/lib/opm-api';
import {
  createTransaction,
  getTransactionByOpmOrderId,
  updateTransactionStatusByOpmOrderId,
  getClabeAccountByClabe,
  sql
} from '@/lib/db';
import { Order } from '@/types';

// Configuration
const DAYS_TO_SYNC = 30;
const ITEMS_PER_PAGE = 100;

interface SyncResult {
  totalFromOpm: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
  opmBalance: number | null;
  localBalance: {
    incoming: number;
    outgoing: number;
    net: number;
  };
}

/**
 * Determine transaction status from OPM order flags
 */
function getStatusFromOrder(order: Order): string {
  if (order.canceled) return 'canceled';
  if (order.returned) return 'returned';
  if (order.scattered) return 'scattered';
  if (order.sent) return 'sent';
  return 'pending';
}

/**
 * Sync a single order from OPM to local database
 */
async function syncOrder(order: Order, type: 'incoming' | 'outgoing'): Promise<'inserted' | 'updated' | 'unchanged' | 'error'> {
  try {
    // Check if transaction exists in local DB
    const existing = await getTransactionByOpmOrderId(order.id);
    const newStatus = getStatusFromOrder(order);

    if (!existing) {
      // Insert new transaction
      const clabeAccount = type === 'outgoing'
        ? await getClabeAccountByClabe(order.payerAccount)
        : await getClabeAccountByClabe(order.beneficiaryAccount);

      await createTransaction({
        id: `tx_sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        clabeAccountId: clabeAccount?.id,
        type,
        status: newStatus,
        amount: order.amount,
        concept: order.concept,
        trackingKey: order.trackingKey,
        numericalReference: order.numericalReference,
        beneficiaryAccount: order.beneficiaryAccount,
        beneficiaryBank: order.beneficiaryBank,
        beneficiaryName: order.beneficiaryName,
        beneficiaryUid: order.beneficiaryUid,
        payerAccount: order.payerAccount,
        payerBank: order.payerBank,
        payerName: order.payerName,
        payerUid: order.payerUid,
        opmOrderId: order.id,
      });

      return 'inserted';
    }

    // Check if status needs update
    if (existing.status !== newStatus) {
      await updateTransactionStatusByOpmOrderId(order.id, newStatus, order.errorDetail || undefined);
      return 'updated';
    }

    return 'unchanged';
  } catch (error) {
    console.error(`Error syncing order ${order.id}:`, error);
    return 'error';
  }
}

/**
 * Fetch all orders from OPM with pagination
 */
async function fetchAllOrders(type: 0 | 1, fromDate: Date, toDate: Date): Promise<Order[]> {
  const allOrders: Order[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params: ListOrdersParams = {
      type,
      page,
      itemsPerPage: ITEMS_PER_PAGE,
      from: fromDate.getTime(),
      to: toDate.getTime(),
    };

    try {
      const response = await listOrders(params);

      if (response.code === 200 && response.data && Array.isArray(response.data)) {
        allOrders.push(...response.data);

        // Check if there are more pages
        if (response.data.length < ITEMS_PER_PAGE) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        console.warn(`OPM API returned code ${response.code} for type ${type}, page ${page}`);
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching orders type ${type}, page ${page}:`, error);
      hasMore = false;
    }
  }

  return allOrders;
}

/**
 * Calculate local database balance
 */
async function calculateLocalBalance(): Promise<{ incoming: number; outgoing: number; net: number }> {
  try {
    const result = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'incoming' AND status = 'scattered' THEN amount ELSE 0 END), 0) as incoming,
        COALESCE(SUM(CASE WHEN type = 'outgoing' AND status IN ('sent', 'scattered') THEN amount ELSE 0 END), 0) as outgoing
      FROM transactions
    `;

    const incoming = parseFloat(result[0]?.incoming || '0');
    const outgoing = parseFloat(result[0]?.outgoing || '0');

    return {
      incoming,
      outgoing,
      net: incoming - outgoing,
    };
  } catch (error) {
    console.error('Error calculating local balance:', error);
    return { incoming: 0, outgoing: 0, net: 0 };
  }
}

/**
 * Main synchronization function
 */
export async function syncOpmTransactions(account?: string): Promise<SyncResult> {
  console.log('=== OPM TRANSACTION SYNC STARTED ===');
  console.log('Timestamp:', new Date().toISOString());

  const result: SyncResult = {
    totalFromOpm: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    opmBalance: null,
    localBalance: { incoming: 0, outgoing: 0, net: 0 },
  };

  // Calculate date range
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - DAYS_TO_SYNC);

  console.log(`Syncing transactions from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

  // Step 1: Get OPM balance
  const balanceAccount = account || process.env.OPM_DEFAULT_ACCOUNT;
  if (balanceAccount) {
    try {
      console.log(`\nFetching balance for account: ${balanceAccount}`);
      const balanceResponse = await getBalance(balanceAccount);
      if (balanceResponse.code === 200 && balanceResponse.data) {
        result.opmBalance = balanceResponse.data.balance;
        console.log(`OPM Balance: $${result.opmBalance?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
      }
    } catch (error) {
      console.error('Error fetching OPM balance:', error);
      result.errors.push(`Balance fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Step 2: Fetch outgoing orders (type=0, speiOut)
  console.log('\n--- Fetching OUTGOING orders (speiOut) ---');
  const outgoingOrders = await fetchAllOrders(0, fromDate, toDate);
  console.log(`Found ${outgoingOrders.length} outgoing orders`);

  // Step 3: Fetch incoming orders (type=1, speiIn)
  console.log('\n--- Fetching INCOMING orders (speiIn) ---');
  const incomingOrders = await fetchAllOrders(1, fromDate, toDate);
  console.log(`Found ${incomingOrders.length} incoming orders`);

  result.totalFromOpm = outgoingOrders.length + incomingOrders.length;

  // Step 4: Sync outgoing orders
  console.log('\n--- Syncing OUTGOING orders ---');
  for (const order of outgoingOrders) {
    const syncResult = await syncOrder(order, 'outgoing');
    switch (syncResult) {
      case 'inserted':
        result.inserted++;
        console.log(`  [INSERT] Order ${order.id} - $${order.amount} - ${order.beneficiaryName}`);
        break;
      case 'updated':
        result.updated++;
        console.log(`  [UPDATE] Order ${order.id} - status changed to ${getStatusFromOrder(order)}`);
        break;
      case 'unchanged':
        result.unchanged++;
        break;
      case 'error':
        result.errors.push(`Failed to sync outgoing order ${order.id}`);
        break;
    }
  }

  // Step 5: Sync incoming orders
  console.log('\n--- Syncing INCOMING orders ---');
  for (const order of incomingOrders) {
    const syncResult = await syncOrder(order, 'incoming');
    switch (syncResult) {
      case 'inserted':
        result.inserted++;
        console.log(`  [INSERT] Order ${order.id} - $${order.amount} - ${order.payerName}`);
        break;
      case 'updated':
        result.updated++;
        console.log(`  [UPDATE] Order ${order.id} - status changed to ${getStatusFromOrder(order)}`);
        break;
      case 'unchanged':
        result.unchanged++;
        break;
      case 'error':
        result.errors.push(`Failed to sync incoming order ${order.id}`);
        break;
    }
  }

  // Step 6: Calculate local balance
  console.log('\n--- Calculating local balance ---');
  result.localBalance = await calculateLocalBalance();

  // Print summary
  console.log('\n=== SYNC SUMMARY ===');
  console.log(`Total orders from OPM: ${result.totalFromOpm}`);
  console.log(`  - Inserted: ${result.inserted}`);
  console.log(`  - Updated: ${result.updated}`);
  console.log(`  - Unchanged: ${result.unchanged}`);
  console.log(`  - Errors: ${result.errors.length}`);

  console.log('\n--- Balance Comparison ---');
  if (result.opmBalance !== null) {
    console.log(`OPM Balance: $${result.opmBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  }
  console.log(`Local Incoming (scattered): $${result.localBalance.incoming.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(`Local Outgoing (sent/scattered): $${result.localBalance.outgoing.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(`Local Net Balance: $${result.localBalance.net.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);

  if (result.opmBalance !== null) {
    const difference = result.opmBalance - result.localBalance.net;
    if (Math.abs(difference) > 0.01) {
      console.log(`\n⚠️  BALANCE DISCREPANCY: $${difference.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
    } else {
      console.log('\n✅ Balances match!');
    }
  }

  if (result.errors.length > 0) {
    console.log('\n--- Errors ---');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n=== OPM TRANSACTION SYNC COMPLETED ===');

  return result;
}

// CLI execution support - env vars already loaded at top of file
const isMainModule = typeof require !== 'undefined' && require.main === module;
const isDirectExecution = process.argv[1]?.includes('sync-opm-transactions');

if (isMainModule || isDirectExecution) {
  syncOpmTransactions()
    .then((result) => {
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
