#!/usr/bin/env npx ts-node
/**
 * OPM API Diagnostic Script
 *
 * Este script realiza pruebas exhaustivas de la conexión con OPM API
 * para identificar problemas de autenticación.
 *
 * Uso: npx ts-node scripts/opm-diagnostic.ts
 */

// Credenciales directas para prueba (del usuario)
const TEST_API_KEY = 'cba28c3936558c5bf851d5d67d9d36a1fb69b27a717d6fe4ecd759215e7ef632';
const API_BASE_URL = 'https://apiuat.opm.mx';

interface TestResult {
  test: string;
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  headers?: Record<string, string>;
}

async function runDiagnostics(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           OPM API DIAGNOSTIC TOOL                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📋 Configuración:');
  console.log(`   API URL: ${API_BASE_URL}`);
  console.log(`   API Key: ${TEST_API_KEY.substring(0, 10)}...${TEST_API_KEY.substring(TEST_API_KEY.length - 10)}`);
  console.log(`   API Key Length: ${TEST_API_KEY.length} caracteres`);
  console.log('');

  const results: TestResult[] = [];

  // Test 1: Verificar conectividad básica (sin auth)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 1: Conectividad básica (sin autenticación)');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const response = await fetch(`${API_BASE_URL}/api/1.0/banks/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 200)}...`);
    results.push({
      test: 'Sin autenticación',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 200),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'Sin autenticación',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 2: Con X-Custom-Auth (formato correcto según documentación)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 2: Con X-Custom-Auth (formato documentación OPM)');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Custom-Auth': TEST_API_KEY,
    };
    console.log('   Headers enviados:');
    Object.entries(headers).forEach(([key, value]) => {
      if (key === 'X-Custom-Auth') {
        console.log(`     ${key}: ${value.substring(0, 10)}...`);
      } else {
        console.log(`     ${key}: ${value}`);
      }
    });

    const response = await fetch(`${API_BASE_URL}/api/1.0/banks/`, {
      method: 'GET',
      headers,
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Headers:`);
    response.headers.forEach((value, key) => {
      console.log(`     ${key}: ${value}`);
    });
    console.log(`   Response Body: ${text.substring(0, 500)}`);
    results.push({
      test: 'X-Custom-Auth',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 500),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'X-Custom-Auth',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 3: Con X-Custom-Auth sin espacios/trim
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 3: Con X-Custom-Auth (trimmed)');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const trimmedKey = TEST_API_KEY.trim();
    console.log(`   Key trimmed length: ${trimmedKey.length}`);
    console.log(`   Key has whitespace: ${TEST_API_KEY !== trimmedKey}`);

    const response = await fetch(`${API_BASE_URL}/api/1.0/banks/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': trimmedKey,
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 200)}`);
    results.push({
      test: 'X-Custom-Auth (trimmed)',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 200),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'X-Custom-Auth (trimmed)',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 4: Probar endpoint accountTypes (otro endpoint simple)
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 4: Endpoint /accountTypes/ con X-Custom-Auth');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const response = await fetch(`${API_BASE_URL}/api/1.0/accountTypes/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': TEST_API_KEY,
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 300)}`);
    results.push({
      test: 'accountTypes endpoint',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 300),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'accountTypes endpoint',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 5: Probar endpoint paymentTypes
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 5: Endpoint /paymentTypes/ con X-Custom-Auth');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const response = await fetch(`${API_BASE_URL}/api/1.0/paymentTypes/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': TEST_API_KEY,
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 300)}`);
    results.push({
      test: 'paymentTypes endpoint',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 300),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'paymentTypes endpoint',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 6: URL sin trailing slash
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 6: URL sin trailing slash /banks (sin /)');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const response = await fetch(`${API_BASE_URL}/api/1.0/banks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': TEST_API_KEY,
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 200)}`);
    results.push({
      test: 'Sin trailing slash',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 200),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'Sin trailing slash',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Test 7: Con User-Agent
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 TEST 7: Con User-Agent adicional');
  console.log('═══════════════════════════════════════════════════════════════');
  try {
    const response = await fetch(`${API_BASE_URL}/api/1.0/banks/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Auth': TEST_API_KEY,
        'User-Agent': 'NOVACORE/1.0',
        'Accept': 'application/json',
      },
    });
    const text = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 200)}`);
    results.push({
      test: 'Con User-Agent',
      success: response.ok,
      statusCode: response.status,
      response: text.substring(0, 200),
    });
  } catch (error) {
    console.log(`   Error: ${error}`);
    results.push({
      test: 'Con User-Agent',
      success: false,
      error: String(error),
    });
  }
  console.log('');

  // Resumen
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      RESUMEN DE RESULTADOS                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.test}`);
    console.log(`   Status Code: ${result.statusCode || 'N/A'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Diagnóstico
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        DIAGNÓSTICO                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const all401 = results.every(r => r.statusCode === 401);
  const someSuccess = results.some(r => r.success);

  if (someSuccess) {
    console.log('✅ Al menos una prueba fue exitosa. La conexión funciona.');
  } else if (all401) {
    console.log('❌ Todas las pruebas retornaron 401 Unauthorized.');
    console.log('');
    console.log('Posibles causas:');
    console.log('  1. API Key no está activado en el dashboard de OPM');
    console.log('  2. API Key es para un ambiente diferente (producción vs UAT)');
    console.log('  3. La IP del servidor NO está en la whitelist de OPM');
    console.log('  4. La cuenta en OPM necesita activación adicional');
    console.log('');
    console.log('Acciones recomendadas:');
    console.log('  1. Verificar en el dashboard UAT de OPM:');
    console.log('     https://transfercld.com:10443/');
    console.log('  2. Confirmar que la IP está registrada');
    console.log('  3. Contactar soporte de OPM con este log');
  } else {
    console.log('⚠️ Resultados mixtos. Revisar cada prueba individualmente.');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Ejecutar
runDiagnostics().catch(console.error);
