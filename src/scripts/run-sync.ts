/**
 * CLI Runner for OPM Transaction Synchronization
 *
 * Usage: npx ts-node --project tsconfig.json src/scripts/run-sync.ts
 * Or: npm run sync-opm
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

// Now import the sync function
import { syncOpmTransactions } from './sync-opm-transactions';

// Run the sync
syncOpmTransactions()
  .then((result) => {
    process.exit(result.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
