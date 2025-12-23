#!/bin/bash
#
# Script para probar endpoints no documentados de OPM API
# Ejecutar en el servidor de producción donde hay conectividad a OPM
#
# Uso: ./scripts/probe-opm-api.sh
#

# Cargar variables de entorno
if [ -f .env ]; then
    export $(cat .env | grep -E "^(OPM_API_KEY|OPM_API_URL)" | xargs)
fi

# Configuración
API_BASE="${OPM_API_URL:-https://api.opm.mx}"
API_KEY="${OPM_API_KEY}"

if [ -z "$API_KEY" ]; then
    echo "ERROR: OPM_API_KEY no está configurada"
    exit 1
fi

echo "============================================================"
echo "OPM API Endpoint Probe"
echo "============================================================"
echo "Base URL: $API_BASE"
echo "API Key: ${API_KEY:0:8}..."
echo "============================================================"
echo ""

# Función para probar un endpoint
probe_endpoint() {
    local method=$1
    local endpoint=$2
    local body=$3

    local url="${API_BASE}/api/1.0/${endpoint}"

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$url" \
            -H "Content-Type: application/json" \
            -H "X-Custom-Auth: $API_KEY" \
            --connect-timeout 10 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -H "X-Custom-Auth: $API_KEY" \
            -d "$body" \
            --connect-timeout 10 2>&1)
    fi

    # Extraer código HTTP (última línea)
    http_code=$(echo "$response" | tail -n1)
    # Extraer body (todo menos última línea)
    body_response=$(echo "$response" | sed '$d')

    # Colorear resultado
    case $http_code in
        200|201)
            color="\033[32m" # Verde
            ;;
        400|401|403)
            color="\033[36m" # Cyan (podría existir)
            ;;
        404)
            color="\033[33m" # Amarillo
            ;;
        *)
            color="\033[31m" # Rojo
            ;;
    esac

    printf "[$method] %-40s ${color}%s\033[0m\n" "$endpoint" "$http_code"

    # Si no es 404, mostrar detalles
    if [ "$http_code" != "404" ] && [ "$http_code" != "000" ]; then
        echo "    Response: ${body_response:0:150}"
        echo ""
    fi
}

echo "=== Probando endpoints documentados primero ==="
echo ""
probe_endpoint "GET" "banks/"
probe_endpoint "GET" "accountTypes/"
probe_endpoint "GET" "paymentTypes/"
probe_endpoint "GET" "indirectParticipantClients/"

echo ""
echo "=== Probando endpoints relacionados con subProductId ==="
echo ""

# GET endpoints
endpoints_get=(
    "subProducts/"
    "subProducts"
    "subproducts/"
    "sub-products/"
    "products/"
    "products"
    "virtualAccounts/"
    "virtualAccounts"
    "virtual-accounts/"
    "referenceAccounts/"
    "reference-accounts/"
    "cuentasReferenciadoras/"
    "subAccounts/"
    "sub-accounts/"
    "subcuentas/"
    "clients/"
    "clientes/"
    "participantClients/"
    "directParticipantClients/"
    "clabes/"
    "clabe/"
    "clabeAccounts/"
    "accounts/"
    "cuentas/"
    "concentrators/"
    "concentrador/"
    "costCenters/"
    "beneficiaries/"
    "beneficiarios/"
)

for endpoint in "${endpoints_get[@]}"; do
    probe_endpoint "GET" "$endpoint"
    sleep 0.3
done

echo ""
echo "=== Probando POST endpoints ==="
echo ""

# Datos de prueba mínimos
test_body='{"name":"Test","rfc":"TEST000000000"}'

endpoints_post=(
    "subProducts/"
    "subProducts"
    "virtualAccounts/"
    "virtualAccounts"
    "referenceAccounts/"
    "subAccounts/"
    "clients/"
    "accounts/"
    "clabes/"
)

for endpoint in "${endpoints_post[@]}"; do
    probe_endpoint "POST" "$endpoint" "$test_body"
    sleep 0.3
done

echo ""
echo "============================================================"
echo "RESUMEN"
echo "============================================================"
echo ""
echo "Endpoints con respuesta diferente a 404:"
echo "(Estos podrían ser endpoints válidos no documentados)"
echo ""
echo "Nota: Si encuentras un endpoint con 400 o 403,"
echo "podría significar que existe pero requiere otros parámetros/permisos."
echo ""
echo "============================================================"
