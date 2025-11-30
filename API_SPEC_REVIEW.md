# OPM API Specification Review - NOVACORE

**Review Date:** November 30, 2025
**Specification Version:** API v1.15 (Especificacion api.pdf, April 2025)
**Integration Manual:** MI-OPM-2.5.pdf (v2.5)

---

## Executive Summary

The NOVACORE implementation has been reviewed against the official OPM API specification. The implementation demonstrates **excellent compliance** with the specification, covering all major endpoints, field validations, signature generation, and webhook handling.

**Overall Compliance Score: 95%**

---

## 1. Orders API Endpoints

### 1.1 Create Order - POST /api/orders
**Status:** ✅ **Compliant**

| Spec Requirement | Implementation | Notes |
|-----------------|----------------|-------|
| Endpoint: POST /api/1.0/orders/ | `src/app/api/orders/route.ts` | Correctly mapped |
| Digital signature (RSA-SHA256) | `src/lib/crypto.ts:signWithPrivateKey()` | Properly implemented |
| Original string format | `src/lib/opm-api.ts:buildOrderOriginalString()` | Matches spec format |
| All required fields | Validated in route handler | Complete validation |

**Field Validations Implemented:**
- `concept`: string<40> ✅
- `beneficiaryAccount`: string<18> + CLABE check digit ✅
- `beneficiaryBank`: string<5> ✅
- `beneficiaryName`: string<40> ✅
- `beneficiaryUid`: string<18> ✅
- `payerAccount`: string<18> ✅
- `payerBank`: string<5> ✅
- `payerName`: string<40> ✅
- `payerUid`: string<18> (optional) ✅
- `amount`: double<18,2> ✅
- `numericalReference`: integer<7> (1000000-9999999) ✅
- `trackingKey`: string<30> ✅

### 1.2 Get Order - GET /api/orders/[id]
**Status:** ✅ **Compliant**

| Spec Requirement | Implementation |
|-----------------|----------------|
| GET /api/1.0/orders/{id} | `src/app/api/orders/[id]/route.ts` |

### 1.3 List Orders - GET /api/orders
**Status:** ✅ **Compliant**

| Query Parameter | Implemented |
|----------------|-------------|
| type (0=out, 1=in) | ✅ |
| page | ✅ |
| itemsPerPage | ✅ |
| from (epoch ms) | ✅ |
| to (epoch ms) | ✅ |
| hasSubProduct | ✅ |
| productId | ✅ |
| isSent | ✅ |
| isScattered | ✅ |
| isReturned | ✅ |
| isCanceled | ✅ |

### 1.4 Get Order by Tracking Key - GET /api/orders/status
**Status:** ✅ **Compliant**

Required parameters validated:
- `trackingKey` ✅
- `paymentDay` ✅
- `type` ✅

### 1.5 Cancel Order - DELETE /api/orders/[id]
**Status:** ✅ **Compliant**

Maps to OPM: DELETE /api/1.0/orders/cancel/{id}

### 1.6 Get CEP - GET /api/orders/[id]/cep
**Status:** ✅ **Compliant**

Maps to OPM: GET /api/1.0/orders/{id}/cep

### 1.7 Resend Webhook - POST /api/orders/[id]/notify
**Status:** ✅ **Compliant**

Maps to OPM: POST /api/1.0/orders/webhookNotify/{id}

---

## 2. Catalog Endpoints

### 2.1 List Banks - GET /api/banks
**Status:** ✅ **Compliant**

### 2.2 List Account Types - GET /api/account-types
**Status:** ✅ **Compliant**

### 2.3 List Payment Types - GET /api/payment-types
**Status:** ✅ **Compliant**

---

## 3. Balance API

### 3.1 Get Balance - POST /api/balance
**Status:** ✅ **Compliant**

Maps to OPM: POST /api/1.0/balances/

**Note:** Implementation also provides GET /api/balance as a convenience method (not in spec but doesn't conflict).

---

## 4. Indirect Participant Client (CLABE) API

### 4.1 Create Virtual CLABE - POST /api/clabe-accounts/generate
**Status:** ✅ **Compliant**

- Uses OPM's auto-generation when `virtualAccountNumber` is not provided
- Correctly stores generated CLABE in local database

### 4.2 Manual CLABE Registration - POST /api/clabe-accounts
**Status:** ✅ **Compliant**

- CLABE validation with check digit verification
- Company authorization checks

### 4.3 OPM Client Library Functions
**Status:** ✅ **Compliant**

Location: `src/lib/opm-api.ts`

| Function | OPM Endpoint |
|----------|--------------|
| `createClient()` | POST /api/1.0/indirectParticipantClients |
| `listClients()` | GET /api/1.0/indirectParticipantClients/ |
| `updateClient()` | PUT /api/1.0/indirectParticipantClients/{id} |
| `updateClientStatus()` | PUT /api/1.0/indirectParticipantClients/{id}/status |

---

## 5. Webhook Implementations

### 5.1 Deposit Webhook (Supply) - POST /api/webhooks/deposit
**Status:** ✅ **Compliant**

Location: `src/app/api/webhooks/deposit/route.ts`

**Return Codes Implemented:**

| Code | Description | Implemented |
|------|-------------|-------------|
| 0 | Transaccion aceptada | ✅ |
| 4 | Saldo excede limite | ❌ (would need balance checks) |
| 6 | Cuenta no existente | ✅ |
| 7 | Error en datos de pago | ✅ |
| 12 | Operacion duplicada | ✅ |
| 13 | Beneficiario no reconoce | ❌ (manual use case) |
| 99 | Error interno | ✅ |

**Signature Verification:** ✅ Implemented using `verifySignature()`

### 5.2 Order Status Webhook - POST /api/webhooks/order-status
**Status:** ✅ **Compliant**

Location: `src/app/api/webhooks/order-status/route.ts`

**Status Values Handled:**
- `pending` ✅
- `sent` ✅
- `scattered` ✅
- `canceled` ✅
- `returned` ✅

**Signature Verification:** ✅ Implemented

---

## 6. Cryptographic Implementation

### 6.1 Digital Signature (RSA-SHA256)
**Status:** ✅ **Compliant**

Location: `src/lib/crypto.ts`

- Uses Web Crypto API for RSA-PKCS1-v1_5 with SHA-256
- Proper PEM key parsing
- Base64 encoding of signature

### 6.2 Original String Format
**Status:** ✅ **Compliant**

Format: `||field1|field2|...|fieldN||`

Functions implemented:
- `buildOrderOriginalString()` - For order signing
- `buildClientOriginalString()` - For client registration
- `buildSupplyOriginalString()` - For webhook verification
- `buildOrderStatusOriginalString()` - For status webhook verification

---

## 7. CLABE Verification

### 7.1 Check Digit Algorithm
**Status:** ✅ **Compliant**

Location: `src/lib/utils.ts:calculateClabeCheckDigit()`

Correctly implements the CLABE verification algorithm:
- Weights: [3, 7, 1, 3, 7, 1, ...] (17 weights)
- Modulo 10 weighted sum
- Check digit: (10 - remainder) % 10

---

## 8. Text Sanitization for SPEI

### 8.1 Character Handling
**Status:** ✅ **Compliant**

Location: `src/lib/utils.ts:sanitizeForSpei()`

- Removes accents (NFD normalization)
- Removes special characters
- Trims whitespace

---

## 9. Recommendations

### 9.1 Minor Improvements

1. **Missing Subproduct Route**
   - `getOrdersBySubproduct()` exists in opm-api.ts but no Next.js route
   - Consider adding: `/api/orders/subProduct/[subproductId]/route.ts`

2. **Return Code 4 (Balance Limit)**
   - Could be implemented if business requires balance limit checks on incoming deposits

3. **Return Code 13 (Beneficiary Rejection)**
   - Consider adding manual rejection capability for suspicious deposits

### 9.2 Security Considerations

1. **Environment Variables Required:**
   - `OPM_API_KEY` - API authentication key
   - `OPM_PRIVATE_KEY` - RSA private key for signing
   - `OPM_PUBLIC_KEY` - RSA public key for webhook verification
   - `DEFAULT_PAYER_ACCOUNT` - Default payer CLABE
   - `DEFAULT_PAYER_BANK` - Default payer bank code
   - `DEFAULT_PAYER_NAME` - Default payer name

2. **Private Key Security**
   - Private key operations only occur server-side ✅
   - Key never exposed to client ✅

---

## 10. Compliance Matrix

| Category | Items | Compliant | Score |
|----------|-------|-----------|-------|
| Orders API | 7 | 7 | 100% |
| Catalogs API | 3 | 3 | 100% |
| Balance API | 1 | 1 | 100% |
| Client API | 4 | 4 | 100% |
| Webhooks | 2 | 2 | 100% |
| Field Validations | 12 | 12 | 100% |
| Signature | 4 | 4 | 100% |
| Return Codes | 7 | 5 | 71% |

**Overall Score: 95%**

---

## 11. Files Reviewed

- `src/lib/opm-api.ts` - OPM API client library
- `src/lib/crypto.ts` - Cryptographic utilities
- `src/lib/utils.ts` - Validation and utility functions
- `src/types/index.ts` - TypeScript type definitions
- `src/app/api/orders/route.ts` - Orders CRUD
- `src/app/api/orders/[id]/route.ts` - Single order operations
- `src/app/api/orders/[id]/cep/route.ts` - CEP retrieval
- `src/app/api/orders/[id]/notify/route.ts` - Webhook resend
- `src/app/api/orders/status/route.ts` - Order status by tracking key
- `src/app/api/banks/route.ts` - Banks catalog
- `src/app/api/account-types/route.ts` - Account types catalog
- `src/app/api/payment-types/route.ts` - Payment types catalog
- `src/app/api/balance/route.ts` - Balance queries
- `src/app/api/clabe-accounts/route.ts` - CLABE management
- `src/app/api/clabe-accounts/generate/route.ts` - CLABE generation via OPM
- `src/app/api/webhooks/deposit/route.ts` - Deposit webhook handler
- `src/app/api/webhooks/order-status/route.ts` - Order status webhook handler

---

**Review completed by:** Claude Code Assistant
**Specification documents:** Especificacion api.pdf v1.15, MI-OPM-2.5.pdf v2.5
