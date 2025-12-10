#!/bin/bash
#
# OPM API Test Script - Ejecutar en servidor AWS
#
# Uso: ./test-opm-curl.sh
#

API_KEY="cba28c3936558c5bf851d5d67d9d36a1fb69b27a717d6fe4ecd759215e7ef632"
API_URL="https://apiuat.opm.mx"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           OPM API CURL TEST                                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Configuración:"
echo "   API URL: $API_URL"
echo "   API Key: ${API_KEY:0:10}...${API_KEY: -10}"
echo ""

# Obtener IP pública
echo "═══════════════════════════════════════════════════════════════"
echo "🌐 IP Pública de este servidor:"
echo "═══════════════════════════════════════════════════════════════"
curl -s ifconfig.me
echo ""
echo ""

# Test 1: Verificar DNS y conectividad
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 1: Verificar DNS y conectividad SSL"
echo "═══════════════════════════════════════════════════════════════"
echo "Resolviendo apiuat.opm.mx..."
nslookup apiuat.opm.mx 2>&1 | head -10
echo ""
echo "Verificando puerto 443..."
timeout 5 bash -c "</dev/tcp/apiuat.opm.mx/443" 2>/dev/null && echo "✅ Puerto 443 accesible" || echo "❌ Puerto 443 NO accesible"
echo ""

# Test 2: GET /banks/ con X-Custom-Auth
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 2: GET /api/1.0/banks/ con X-Custom-Auth"
echo "═══════════════════════════════════════════════════════════════"
echo "Comando:"
echo "  curl -X GET \"$API_URL/api/1.0/banks/\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -H \"X-Custom-Auth: [API_KEY]\""
echo ""
echo "Respuesta:"
curl -v -X GET "$API_URL/api/1.0/banks/" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Auth: $API_KEY" 2>&1
echo ""
echo ""

# Test 3: GET /accountTypes/
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 3: GET /api/1.0/accountTypes/"
echo "═══════════════════════════════════════════════════════════════"
curl -s -w "\nHTTP Status: %{http_code}\n" -X GET "$API_URL/api/1.0/accountTypes/" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Auth: $API_KEY"
echo ""
echo ""

# Test 4: GET /paymentTypes/
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 4: GET /api/1.0/paymentTypes/"
echo "═══════════════════════════════════════════════════════════════"
curl -s -w "\nHTTP Status: %{http_code}\n" -X GET "$API_URL/api/1.0/paymentTypes/" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Auth: $API_KEY"
echo ""
echo ""

# Test 5: Sin trailing slash
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 5: GET /api/1.0/banks (sin trailing slash)"
echo "═══════════════════════════════════════════════════════════════"
curl -s -w "\nHTTP Status: %{http_code}\n" -X GET "$API_URL/api/1.0/banks" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Auth: $API_KEY"
echo ""
echo ""

# Test 6: Con verbose para ver headers completos
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 6: Request verbose (headers completos)"
echo "═══════════════════════════════════════════════════════════════"
curl -v -X GET "$API_URL/api/1.0/banks/" \
  -H "Content-Type: application/json" \
  -H "X-Custom-Auth: $API_KEY" \
  -H "Accept: application/json" \
  2>&1 | head -50
echo ""
echo ""

# Test 7: Sin autenticación (para comparar)
echo "═══════════════════════════════════════════════════════════════"
echo "🔍 TEST 7: Sin autenticación (para comparar)"
echo "═══════════════════════════════════════════════════════════════"
curl -s -w "\nHTTP Status: %{http_code}\n" -X GET "$API_URL/api/1.0/banks/" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 FIN DE PRUEBAS                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Si todas las pruebas retornan 401, verifica:"
echo "  1. Que la IP de arriba esté registrada en OPM"
echo "  2. Que el API Key esté activo en: https://transfercld.com:10443/"
echo "  3. Contacta a soporte de OPM con estos resultados"
