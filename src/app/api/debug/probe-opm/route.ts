import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-middleware';

/**
 * POST /api/debug/probe-opm - Probe OPM API for undocumented endpoints
 *
 * This endpoint tests various potential OPM API endpoints to find
 * undocumented ways to create subproducts/reference accounts.
 *
 * SECURITY: Requires super_admin authentication
 * WARNING: This endpoint should be removed or disabled in production
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_OPM_API_URL || 'https://api.opm.mx';
const API_KEY = process.env.OPM_API_KEY || '';

interface ProbeResult {
  endpoint: string;
  method: string;
  status: number;
  statusText: string;
  response?: any;
  error?: string;
  interesting: boolean;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    const interesting = response.status !== 404;

    return {
      endpoint,
      method,
      status: response.status,
      statusText: response.statusText,
      response: responseData,
      interesting,
    };
  } catch (error: any) {
    return {
      endpoint,
      method,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      interesting: false,
    };
  }
}

export async function POST(request: NextRequest) {
  // SECURITY FIX: Require super_admin authentication
  // This endpoint exposes sensitive OPM API probing capability
  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    );
  }

  if (authResult.user.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Solo super_admin puede usar este endpoint de debug' },
      { status: 403 }
    );
  }

  // Additional check: Block in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
    return NextResponse.json(
      { error: 'Debug endpoint disabled in production. Set ENABLE_DEBUG_ENDPOINTS=true to enable.' },
      { status: 403 }
    );
  }

  console.log('=== OPM ENDPOINT PROBE STARTED ===');
  console.log(`API Base: ${API_BASE_URL}`);
  // SECURITY FIX: Don't log any part of the API key
  console.log(`API Key configured: ${API_KEY ? 'YES' : 'NOT SET'}`);

  const results: ProbeResult[] = [];

  // First test documented endpoints to verify connectivity
  console.log('\n--- Testing documented endpoints ---');
  const documentedEndpoints = [
    { endpoint: 'banks/', method: 'GET' as const },
    { endpoint: 'accountTypes/', method: 'GET' as const },
    { endpoint: 'paymentTypes/', method: 'GET' as const },
    { endpoint: 'indirectParticipantClients/', method: 'GET' as const },
  ];

  for (const { endpoint, method } of documentedEndpoints) {
    const result = await probeEndpoint(endpoint, method);
    results.push(result);
    console.log(`[${method}] ${endpoint}: ${result.status} ${result.statusText}`);
  }

  // Test potential undocumented endpoints
  console.log('\n--- Testing potential undocumented endpoints ---');
  const potentialEndpoints = [
    // SubProduct related (since subProductId exists in responses)
    { endpoint: 'subProducts/', method: 'GET' as const },
    { endpoint: 'subProducts', method: 'GET' as const },
    { endpoint: 'subproducts/', method: 'GET' as const },
    { endpoint: 'sub-products/', method: 'GET' as const },

    // Products
    { endpoint: 'products/', method: 'GET' as const },
    { endpoint: 'products', method: 'GET' as const },

    // Virtual accounts
    { endpoint: 'virtualAccounts/', method: 'GET' as const },
    { endpoint: 'virtual-accounts/', method: 'GET' as const },

    // Reference accounts (cuentas referenciadoras)
    { endpoint: 'referenceAccounts/', method: 'GET' as const },
    { endpoint: 'reference-accounts/', method: 'GET' as const },
    { endpoint: 'cuentasReferenciadoras/', method: 'GET' as const },

    // Sub accounts
    { endpoint: 'subAccounts/', method: 'GET' as const },
    { endpoint: 'sub-accounts/', method: 'GET' as const },
    { endpoint: 'subcuentas/', method: 'GET' as const },

    // Clients
    { endpoint: 'clients/', method: 'GET' as const },
    { endpoint: 'clientes/', method: 'GET' as const },

    // Participant clients variants
    { endpoint: 'participantClients/', method: 'GET' as const },
    { endpoint: 'directParticipantClients/', method: 'GET' as const },

    // CLABE specific
    { endpoint: 'clabes/', method: 'GET' as const },
    { endpoint: 'clabe/', method: 'GET' as const },
    { endpoint: 'clabeAccounts/', method: 'GET' as const },

    // Accounts
    { endpoint: 'accounts/', method: 'GET' as const },
    { endpoint: 'cuentas/', method: 'GET' as const },

    // Cost centers
    { endpoint: 'costCenters/', method: 'GET' as const },
    { endpoint: 'centrosCostos/', method: 'GET' as const },

    // Concentrators
    { endpoint: 'concentrators/', method: 'GET' as const },
    { endpoint: 'concentrador/', method: 'GET' as const },
  ];

  for (const { endpoint, method } of potentialEndpoints) {
    const result = await probeEndpoint(endpoint, method);
    results.push(result);
    console.log(`[${method}] ${endpoint}: ${result.status} ${result.statusText}`);

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Test POST endpoints
  console.log('\n--- Testing POST endpoints ---');
  const testBody = { name: 'Test', rfc: 'TEST000000000' };
  const postEndpoints = [
    'subProducts/',
    'virtualAccounts/',
    'referenceAccounts/',
    'subAccounts/',
    'clients/',
    'accounts/',
  ];

  for (const endpoint of postEndpoints) {
    const result = await probeEndpoint(endpoint, 'POST', testBody);
    results.push(result);
    console.log(`[POST] ${endpoint}: ${result.status} ${result.statusText}`);

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Filter interesting results
  const interesting = results.filter(r => r.interesting);
  const notFound = results.filter(r => r.status === 404);
  const errors = results.filter(r => r.status === 0);

  console.log('\n=== PROBE COMPLETE ===');
  console.log(`Interesting: ${interesting.length}, Not Found: ${notFound.length}, Errors: ${errors.length}`);

  return NextResponse.json({
    summary: {
      total: results.length,
      interesting: interesting.length,
      notFound: notFound.length,
      errors: errors.length,
    },
    config: {
      apiBase: API_BASE_URL,
      apiKeySet: !!API_KEY,
    },
    interestingResults: interesting.map(r => ({
      endpoint: r.endpoint,
      method: r.method,
      status: r.status,
      statusText: r.statusText,
      response: r.response,
    })),
    allResults: results.map(r => ({
      endpoint: r.endpoint,
      method: r.method,
      status: r.status,
      statusText: r.statusText,
      interesting: r.interesting,
      response: r.status !== 404 ? r.response : undefined,
    })),
  });
}
