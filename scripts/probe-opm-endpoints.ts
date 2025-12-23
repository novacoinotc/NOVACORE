#!/usr/bin/env npx ts-node
/**
 * Script to probe OPM API for undocumented endpoints
 *
 * Since subProductId exists in responses, there might be undocumented
 * endpoints for creating subproducts/reference accounts.
 *
 * Usage: npx ts-node scripts/probe-opm-endpoints.ts
 */

import 'dotenv/config';

const API_BASE_URL = process.env.OPM_API_URL || 'https://api.opm.mx';
const API_KEY = process.env.OPM_API_KEY || '';

interface ProbeResult {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  response?: any;
  error?: string;
}

async function probeEndpoint(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: object
): Promise<ProbeResult> {
  const url = `${API_BASE_URL}/api/1.0/${endpoint}`;

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': API_KEY,
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    let responseData;

    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return {
      endpoint,
      method,
      status: response.status,
      statusText: response.statusText,
      response: responseData,
    };
  } catch (error: any) {
    return {
      endpoint,
      method,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
    };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('OPM API Endpoint Probe');
  console.log('='.repeat(60));
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
  console.log('='.repeat(60));
  console.log('');

  // Endpoints to probe based on subProductId pattern
  const endpointsToProbe = [
    // SubProduct related
    { endpoint: 'subProducts/', method: 'GET' as const },
    { endpoint: 'subProducts', method: 'GET' as const },
    { endpoint: 'subproducts/', method: 'GET' as const },
    { endpoint: 'subproducts', method: 'GET' as const },
    { endpoint: 'sub-products/', method: 'GET' as const },
    { endpoint: 'sub-products', method: 'GET' as const },

    // Products with subproducts
    { endpoint: 'products/', method: 'GET' as const },
    { endpoint: 'products', method: 'GET' as const },

    // Virtual accounts (different naming)
    { endpoint: 'virtualAccounts/', method: 'GET' as const },
    { endpoint: 'virtualAccounts', method: 'GET' as const },
    { endpoint: 'virtual-accounts/', method: 'GET' as const },
    { endpoint: 'virtualacounts/', method: 'GET' as const },

    // Reference accounts (cuentas referenciadoras)
    { endpoint: 'referenceAccounts/', method: 'GET' as const },
    { endpoint: 'referenceAccounts', method: 'GET' as const },
    { endpoint: 'reference-accounts/', method: 'GET' as const },
    { endpoint: 'cuentasReferenciadoras/', method: 'GET' as const },

    // Sub accounts
    { endpoint: 'subAccounts/', method: 'GET' as const },
    { endpoint: 'subAccounts', method: 'GET' as const },
    { endpoint: 'sub-accounts/', method: 'GET' as const },
    { endpoint: 'subcuentas/', method: 'GET' as const },

    // Clients (without indirectParticipant prefix)
    { endpoint: 'clients/', method: 'GET' as const },
    { endpoint: 'clients', method: 'GET' as const },
    { endpoint: 'clientes/', method: 'GET' as const },

    // Participant clients (different prefix)
    { endpoint: 'participantClients/', method: 'GET' as const },
    { endpoint: 'participantClients', method: 'GET' as const },
    { endpoint: 'directParticipantClients/', method: 'GET' as const },
    { endpoint: 'directParticipantClients', method: 'GET' as const },

    // CLABE specific
    { endpoint: 'clabes/', method: 'GET' as const },
    { endpoint: 'clabe/', method: 'GET' as const },
    { endpoint: 'clabeAccounts/', method: 'GET' as const },
    { endpoint: 'clabe-accounts/', method: 'GET' as const },

    // Concentrator related
    { endpoint: 'concentrators/', method: 'GET' as const },
    { endpoint: 'concentrador/', method: 'GET' as const },
    { endpoint: 'cuentasConcentradoras/', method: 'GET' as const },

    // Cost centers
    { endpoint: 'costCenters/', method: 'GET' as const },
    { endpoint: 'cost-centers/', method: 'GET' as const },
    { endpoint: 'centrosCostos/', method: 'GET' as const },

    // Accounts general
    { endpoint: 'accounts/', method: 'GET' as const },
    { endpoint: 'accounts', method: 'GET' as const },
    { endpoint: 'cuentas/', method: 'GET' as const },

    // Beneficiaries
    { endpoint: 'beneficiaries/', method: 'GET' as const },
    { endpoint: 'beneficiarios/', method: 'GET' as const },
  ];

  const results: ProbeResult[] = [];

  console.log('Probing endpoints...\n');

  for (const { endpoint, method } of endpointsToProbe) {
    process.stdout.write(`[${method}] ${endpoint.padEnd(35)} `);
    const result = await probeEndpoint(endpoint, method);
    results.push(result);

    // Color code the status
    let statusColor = '';
    if (result.status === 200) {
      statusColor = '\x1b[32m'; // Green
    } else if (result.status === 404) {
      statusColor = '\x1b[33m'; // Yellow
    } else if (result.status === 401 || result.status === 403) {
      statusColor = '\x1b[36m'; // Cyan (might exist but unauthorized)
    } else {
      statusColor = '\x1b[31m'; // Red
    }

    console.log(`${statusColor}${result.status} ${result.statusText}\x1b[0m`);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.status === 200);
  const unauthorized = results.filter(r => r.status === 401 || r.status === 403);
  const notFound = results.filter(r => r.status === 404);
  const other = results.filter(r => ![200, 401, 403, 404].includes(r.status));

  console.log(`\n✅ Successful (200): ${successful.length}`);
  if (successful.length > 0) {
    successful.forEach(r => {
      console.log(`   - ${r.endpoint}`);
      if (r.response) {
        console.log(`     Response preview: ${JSON.stringify(r.response).substring(0, 100)}...`);
      }
    });
  }

  console.log(`\n🔐 Unauthorized (401/403): ${unauthorized.length}`);
  if (unauthorized.length > 0) {
    console.log('   (These endpoints MIGHT exist but require different permissions)');
    unauthorized.forEach(r => console.log(`   - ${r.endpoint}`));
  }

  console.log(`\n❌ Not Found (404): ${notFound.length}`);

  console.log(`\n⚠️  Other responses: ${other.length}`);
  if (other.length > 0) {
    other.forEach(r => {
      console.log(`   - ${r.endpoint}: ${r.status} ${r.statusText}`);
      if (r.response) {
        console.log(`     Response: ${JSON.stringify(r.response).substring(0, 200)}`);
      }
    });
  }

  // Show detailed responses for interesting endpoints
  const interesting = results.filter(r =>
    r.status === 200 ||
    (r.status !== 404 && r.status !== 0)
  );

  if (interesting.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('DETAILED RESPONSES FOR INTERESTING ENDPOINTS');
    console.log('='.repeat(60));

    for (const result of interesting) {
      console.log(`\n📍 [${result.method}] ${result.endpoint}`);
      console.log(`   Status: ${result.status} ${result.statusText}`);
      if (result.response) {
        console.log('   Response:');
        console.log(JSON.stringify(result.response, null, 2).split('\n').map(l => '   ' + l).join('\n'));
      }
    }
  }

  // Try POST on some endpoints that might create subproducts
  console.log('\n' + '='.repeat(60));
  console.log('PROBING POST ENDPOINTS (create operations)');
  console.log('='.repeat(60));

  const postEndpoints = [
    { endpoint: 'subProducts/', body: { name: 'Test' } },
    { endpoint: 'subProducts', body: { name: 'Test' } },
    { endpoint: 'virtualAccounts/', body: { name: 'Test' } },
    { endpoint: 'virtualAccounts', body: { name: 'Test' } },
    { endpoint: 'referenceAccounts/', body: { name: 'Test' } },
    { endpoint: 'subAccounts/', body: { name: 'Test' } },
    { endpoint: 'clients/', body: { name: 'Test' } },
    { endpoint: 'accounts/', body: { name: 'Test' } },
  ];

  for (const { endpoint, body } of postEndpoints) {
    process.stdout.write(`[POST] ${endpoint.padEnd(35)} `);
    const result = await probeEndpoint(endpoint, 'POST', body);

    let statusColor = '';
    if (result.status === 200 || result.status === 201) {
      statusColor = '\x1b[32m'; // Green
    } else if (result.status === 404) {
      statusColor = '\x1b[33m'; // Yellow
    } else if (result.status === 400 || result.status === 401 || result.status === 403) {
      statusColor = '\x1b[36m'; // Cyan (might exist)
    } else {
      statusColor = '\x1b[31m'; // Red
    }

    console.log(`${statusColor}${result.status} ${result.statusText}\x1b[0m`);

    // If we get anything other than 404, show details
    if (result.status !== 404 && result.status !== 0) {
      console.log(`   Response: ${JSON.stringify(result.response || result.error).substring(0, 150)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('PROBE COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
