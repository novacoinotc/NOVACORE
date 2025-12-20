# NOVACORE - DOCUMENTACIÓN COMPLETA DE FUNCIONES Y SEGURIDAD

## ⚠️ INSTRUCCIONES PARA LA IA QUE REVISARÁ ESTE CÓDIGO

Este documento contiene TODAS las funciones del core bancario NOVACORE.
Al agregar mejoras de seguridad o firma criptográfica de transacciones,
**NO DEBES MODIFICAR** la lógica de las funciones marcadas como CRÍTICAS.

---

## FUNCIONES CRÍTICAS - NO MODIFICAR LÓGICA INTERNA

### 1. BALANCE ATÓMICO POR CUENTA CLABE
**Archivo:** `src/lib/db.ts`
**Función:** `createOutgoingTransactionAtomic()`

```
- Usa SERIALIZABLE isolation + FOR UPDATE NOWAIT
- Valida saldo disponible ANTES de crear transacción
- Previene double-spending y race conditions
- NO MODIFICAR la lógica de bloqueo de filas
```

### 2. CÁLCULO DE SALDO
**Archivo:** `src/lib/db.ts`
**Función:** `getClabeAccountBalance(clabeAccountId)`

```
Fórmula: incoming(scattered) - outgoing(sent,scattered) - in_transit
- Cada CLABE tiene saldo independiente
- NO MODIFICAR la fórmula de cálculo
```

### 3. VALIDACIÓN DE ACCESO A CLABE (IDOR Prevention)
**Archivo:** `src/lib/auth-middleware.ts`
**Función:** `validateClabeAccess(userId, clabeAccountId, role)`

```
- super_admin: acceso a todas las CLABEs
- company_admin: acceso a CLABEs de su empresa
- user: solo CLABEs asignadas en user_clabe_access
- NO MODIFICAR esta lógica de autorización
```

---

## FUNCIONES DE BASE DE DATOS (src/lib/db.ts)

### EMPRESAS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createCompany() | company object | Crea empresa con UUID seguro |
| getCompanyById() | id: string | Obtiene empresa por ID |
| getCompanyByRfc() | rfc: string | Obtiene empresa por RFC |
| getAllCompanies() | - | Lista todas las empresas |
| updateCompany() | id, updates | Actualiza empresa |
| deleteCompany() | id: string | Elimina empresa (CASCADE) |

### CUENTAS CLABE
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createClabeAccount() | clabeAccount object | Crea cuenta CLABE |
| getMainClabeAccount() | companyId: string | Obtiene CLABE concentradora (is_main=true) |
| getClabeAccountById() | id: string | Obtiene CLABE por ID |
| getClabeAccountByClabe() | clabe: string | Obtiene por número CLABE (18 dígitos) |
| getClabeAccountsByCompanyId() | companyId: string | Lista CLABEs de una empresa |
| updateClabeAccount() | id, updates | Actualiza CLABE |
| deleteClabeAccount() | id: string | Elimina CLABE |

### CONTROL DE ACCESO USUARIO-CLABE (CRÍTICO - Multi-tenant)
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| addUserClabeAccess() | userId, clabeAccountId | Asigna acceso a CLABE |
| removeUserClabeAccess() | userId, clabeAccountId | Revoca acceso a CLABE |
| getUserClabeAccess() | userId: string | Lista IDs de CLABEs accesibles |
| setUserClabeAccess() | userId, clabeAccountIds[] | Reemplaza TODOS los accesos |
| getClabeAccountsForUser() | userId: string | Objetos CLABE completos del usuario |
| getUsersWithClabeAccessByCompanyId() | companyId: string | Usuarios con acceso por empresa |

### USUARIOS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createUser() | user object | Crea usuario (password ya hasheado con bcrypt 12 rounds) |
| getUserByEmail() | email: string | Obtiene usuario por email |
| getUserById() | id: string | Obtiene usuario por ID |
| getAllUsers() | - | Lista todos los usuarios |
| updateUser() | id, updates | Actualiza usuario |
| deleteUser() | id: string | Elimina usuario |
| updateLastLogin() | id: string | Registra último acceso |

### SESIONES
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createSession() | session object | Crea sesión (token + 24h expiry) |
| getSessionByToken() | token: string | Valida token + verifica expiración |
| deleteSession() | token: string | Elimina sesión por token |
| invalidateSession() | token: string | Logout individual |
| invalidateAllUserSessions() | userId: string | Logout de TODOS los dispositivos |
| deleteExpiredSessions() | - | Limpieza automática de sesiones expiradas |

### TRANSACCIONES SPEI (CRÍTICO)
| Función | Parámetros | Descripción | CRÍTICO |
|---------|------------|-------------|---------|
| createTransaction() | transaction object | Crea registro de transacción | |
| createOutgoingTransactionAtomic() | transaction object | Transferencia con validación atómica de saldo | ⚠️⚠️⚠️ |
| getClabeAccountBalance() | clabeAccountId: string | Calcula balance disponible de CLABE | ⚠️⚠️⚠️ |
| getClabeBalanceByClabe() | clabe: string | Balance por número CLABE | ⚠️ |
| getTransactionById() | id: string | Obtiene transacción por ID | |
| getTransactionByTrackingKey() | trackingKey: string | Obtiene por clave de rastreo | |
| getTransactionByOpmOrderId() | opmOrderId: string | Obtiene por ID de OPM | |
| updateTransactionStatus() | id, status, errorDetail? | Actualiza estado | |
| updateTransactionStatusByOpmOrderId() | opmOrderId, status | Actualiza por ID OPM | |
| updateTransactionByTrackingKey() | trackingKey, updates | Actualiza por tracking key | |
| confirmPendingTransaction() | id, opmOrderId, status | Confirma después de grace period | |
| getPendingConfirmationTransactions() | - | Pendientes de envío a OPM | |
| getTransactionForCancel() | id: string | Verifica si puede cancelarse | |
| listTransactions() | filters object | Lista con filtros avanzados | |
| getTransactionsByClabeAccount() | clabeAccountId: string | Transacciones de una CLABE | |
| getTransactionsByCompanyId() | companyId, params | Transacciones de una empresa | |
| getRecentTransactions() | limit?, companyId? | Transacciones recientes | |

### SEGURIDAD DE CUENTA
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| recordFailedLoginAttempt() | userId: string | Registra intento fallido (+1 contador) |
| lockUserAccount() | userId, lockedUntil: Date | Bloquea cuenta hasta fecha/hora |
| resetFailedLoginAttempts() | userId: string | Resetea contador y desbloquea |
| getUserSecurityStatus() | userId: string | Obtiene failed_attempts, lockedUntil, totpEnabled |

### 2FA TOTP
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| saveTotpSecret() | userId, secret: string | Guarda secreto durante configuración |
| enableTotp() | userId: string | Activa 2FA después de verificación |
| disableTotp() | userId: string | Desactiva 2FA (requiere TOTP + password) |
| getUserTotpSecret() | userId: string | Obtiene secreto TOTP (solo servidor) |
| isUserTotpEnabled() | userId: string | Verifica si tiene 2FA activo |

### AUDIT LOGS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createAuditLogEntry() | entry object | Registra evento de auditoría |
| getRecentAuditLogs() | limit?: number | Logs recientes (default 100) |
| getAuditLogsByUser() | userId, limit? | Logs de un usuario específico |
| getAuditLogsByAction() | action, limit? | Logs por tipo de acción |
| getCriticalAuditLogs() | limit?: number | Solo eventos severity='critical' |

### CUENTAS GUARDADAS (Beneficiarios Frecuentes)
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createSavedAccount() | savedAccount object | Crea cuenta de tercero guardada |
| getSavedAccountById() | id: string | Obtiene cuenta guardada |
| getSavedAccountsByUserId() | userId: string | Lista cuentas del usuario |
| updateSavedAccount() | id, updates | Actualiza cuenta guardada |
| deleteSavedAccount() | id: string | Elimina cuenta guardada |
| getSavedAccountByUserAndClabe() | userId, clabe | Busca por usuario y CLABE |

### COMISIONES
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createPendingCommission() | commission object | Registra comisión pendiente |
| getPendingCommissionsByCompany() | companyId: string | Comisiones pendientes de empresa |
| getAllPendingCommissions() | - | Todas las comisiones pendientes |
| getPendingCommissionsGroupedByCompany() | - | Agrupadas por empresa |
| markCommissionsAsProcessed() | commissionIds[], cutoffId | Marca como procesadas |
| markCommissionsAsFailed() | commissionIds[] | Marca como fallidas |
| createCommissionCutoff() | cutoff object | Crea corte de comisiones |
| getCommissionCutoffById() | id: string | Obtiene corte por ID |
| updateCommissionCutoffStatus() | id, status, updates? | Actualiza estado del corte |
| getPendingCommissionCutoffs() | - | Cortes pendientes/en proceso |
| getCommissionCutoffsByCompany() | companyId: string | Cortes de una empresa |
| getTodayCommissionCutoff() | companyId: string | Corte de hoy |
| createCommissionTransaction() | params object | Crea transacción de comisión |

### ESTADÍSTICAS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| getDashboardStats() | companyId?: string | Estadísticas para dashboard (30 días) |
| getCompanyWithDetails() | companyId: string | Empresa con usuarios, CLABEs, stats |

---

## FUNCIONES DE AUTENTICACIÓN (src/lib/auth-middleware.ts)

| Función | Parámetros | Descripción | CRÍTICO |
|---------|------------|-------------|---------|
| authenticateRequest() | request: NextRequest | Valida token contra BD, verifica expiración y usuario activo | ⚠️⚠️⚠️ |
| validateClabeAccess() | userId, clabeAccountId, role | Valida que usuario tiene acceso a CLABE específica | ⚠️⚠️⚠️ |
| extractToken() | request: NextRequest | Extrae token de Authorization header, x-auth-token o cookies | |
| withAuth() | handler, options | HOF para proteger rutas con rol/permiso requerido | |
| getCurrentUserSecure() | request: NextRequest | Obtiene usuario actual con autenticación segura | |
| unauthorizedResponse() | message?: string | Helper: respuesta HTTP 401 | |
| forbiddenResponse() | message?: string | Helper: respuesta HTTP 403 | |

---

## FUNCIONES DE SEGURIDAD (src/lib/security.ts)

### RATE LIMITING
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| checkRateLimit() | identifier: string | Verifica si está bloqueado (5 intentos/15 min) |
| recordFailedAttempt() | identifier: string | Registra intento fallido |
| clearRateLimit() | identifier: string | Limpia después de login exitoso |

### ACCOUNT LOCKOUT
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| shouldLockAccount() | failedAttempts, lockedUntil | Determina si cuenta debe bloquearse |
| calculateLockoutTime() | - | Calcula tiempo de bloqueo (30 min) |

### TOTP 2FA (RFC 6238)
| Función | Parámetros | Descripción | CRÍTICO |
|---------|------------|-------------|---------|
| generateTOTPSecret() | - | Genera secreto base32 (crypto.getRandomValues) | |
| generateTOTPUri() | secret, email, issuer? | URI otpauth:// para QR (Google Authenticator) | |
| verifyTOTP() | secret, code | Verifica código con crypto.timingSafeEqual | ⚠️ |
| generateTOTPCode() | secret, counter | Genera código TOTP (HMAC-SHA1) | |
| base32Decode() | encoded: string | Decodifica base32 a Uint8Array | |

### HELPERS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| getClientIP() | request: Request | Extrae IP del cliente (x-forwarded-for, x-real-ip) |
| getUserAgent() | request: Request | Obtiene User-Agent para logging |
| createAuditLog() | entry object | Crea log de auditoría (wrapper) |

---

## FUNCIONES CRIPTOGRÁFICAS (src/lib/crypto.ts)

| Función | Parámetros | Descripción | CRÍTICO |
|---------|------------|-------------|---------|
| signWithPrivateKey() | data, privateKey | Firma RSA-SHA256 con clave privada | ⚠️ |
| verifySignature() | data, signature, publicKey | Verifica firma RSA-SHA256 | ⚠️ |
| generateNumericalReference() | - | Referencia 7 dígitos (crypto.randomInt) | |
| generateTrackingKey() | prefix?: string | Clave rastreo única 30 chars (crypto.randomBytes) | |
| decodeKeyFromEnv() | encodedKey: string | Decodifica clave Base64/PEM del env | |

---

## FUNCIONES OPM API (src/lib/opm-api.ts)

### ÓRDENES SPEI
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createSignedOrder() | orderData, apiKey? | Crea orden SPEI firmada con RSA-SHA256 |
| createOrder() | orderData, apiKey? | Crea orden sin firma (solo testing) |
| getOrder() | orderId, apiKey? | Obtiene detalles de orden |
| getOrderByTrackingKey() | trackingKey, paymentDay, type, apiKey? | Obtiene por tracking key |
| listOrders() | params, apiKey? | Lista órdenes con filtros |
| cancelOrder() | orderId, apiKey? | Cancela orden (si está pending) |
| getOrderCep() | orderId, apiKey? | Obtiene URL del CEP |
| notifyOrder() | orderId, apiKey? | Reenvía notificación webhook |
| getOrdersBySubproduct() | subproductId, params, apiKey? | Órdenes por subproducto |

### BALANCE
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| getBalance() | account, apiKey? | Balance de cuenta en OPM |

### BANCOS Y TIPOS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| listBanks() | apiKey? | Lista bancos SPEI |
| listAccountTypes() | apiKey? | Lista tipos de cuenta (40=CLABE, etc.) |
| listPaymentTypes() | apiKey? | Lista tipos de pago |

### CLIENTES VIRTUALES
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createSignedClient() | clientData, apiKey? | Crea cliente firmado con RSA |
| createClient() | clientData, apiKey? | Crea cliente sin firma (testing) |
| listClients() | params?, apiKey? | Lista clientes |
| getClientById() | clientId, apiKey? | Obtiene cliente por ID |
| updateClient() | clientId, clientData, apiKey? | Actualiza cliente |
| updateClientStatus() | clientId, status, apiKey? | Cambia estado del cliente |

### CLABE VIRTUAL
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| createVirtualClabe() | request, apiKey? | Genera CLABE virtual/subcuenta |
| listVirtualAccounts() | params?, apiKey? | Lista cuentas virtuales |
| createVirtualClabeSubaccounts() | baseData, count, aliasPrefix?, apiKey? | Crea múltiples CLABEs |

### CONSTRUCCIÓN DE CADENA ORIGINAL (Para Firma)
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| buildOrderOriginalString() | order object | Cadena para firma de orden SPEI |
| buildClientOriginalString() | client object | Cadena para firma de cliente |
| buildSupplyOriginalString() | data object | Para verificar webhook de depósito |
| buildOrderStatusOriginalString() | data object | Para verificar webhook de estado |
| buildVirtualAccountOriginalString() | data object | Cadena para cuenta virtual |

### FIRMA RSA
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| signWithRSA() | originalString, privateKeyPem? | Firma cadena con RSA-SHA256 |
| verifyRSASignature() | originalString, signature, publicKeyPem? | Verifica firma de OPM |

---

## FUNCIONES DE UTILIDADES (src/lib/utils.ts)

### VALIDACIÓN CLABE (CRÍTICO)
| Función | Parámetros | Descripción | CRÍTICO |
|---------|------------|-------------|---------|
| validateClabe() | clabe: string | Valida formato 18 dígitos + dígito verificador | ⚠️ |
| calculateClabeCheckDigit() | clabe17: string | Calcula dígito verificador (algoritmo ponderado) | |

### VALIDACIÓN SPEI
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| validateOrderFields() | order object | Valida todos los campos según spec OPM |
| sanitizeForSpei() | text: string | Elimina acentos y caracteres especiales |
| sanitizeForSpeiSubmit() | text: string | Sanitiza + trim para envío |
| prepareTextForSpei() | text, maxLength | Sanitiza + trunca a longitud máx |

### FORMATEO UI
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| cn() | ...inputs | Combina clases Tailwind |
| formatCurrency() | amount: number | Formatea a MXN ($X,XXX.XX) |
| formatClabe() | clabe: string | Formatea CLABE con espacios |
| formatDate() | epoch: number | Fecha legible (es-MX) |
| formatRelativeTime() | epoch: number | "Hace 5 min", etc. |
| formatCompactNumber() | num: number | 1000 -> 1K, 1000000 -> 1M |
| getStatusColor() | status: string | Color Tailwind según status |
| getStatusText() | status: string | Texto en español del status |
| truncateText() | text, maxLength | Trunca con "..." |
| maskAccount() | account: string | Enmascara cuenta (****XXXX) |

### FECHAS
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| epochToDateString() | epoch: number | Epoch -> YYYY-MM-DD |
| dateStringToEpoch() | dateStr: string | YYYY-MM-DD -> epoch ms |

### TRACKING KEY
| Función | Parámetros | Descripción |
|---------|------------|-------------|
| generateTrackingKey() | - | Clave alfanumérica 30 chars (crypto seguro) |

---

## ENDPOINTS API (58 rutas totales)

### AUTENTICACIÓN (/api/auth/*)
| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| /api/auth/init | POST | No | Inicializa BD y crea super_admin |
| /api/auth/login | POST | No | Login con rate limiting y 2FA |
| /api/auth/logout | POST | No | Logout (invalida sesión en BD) |
| /api/auth/reset-password | POST | No | Solicita/completa reset (token 256 bits) |
| /api/auth/2fa/setup | POST | Sí | Genera secreto TOTP y QR |
| /api/auth/2fa/verify | POST | Sí | Verifica código y activa 2FA |
| /api/auth/2fa/disable | POST | Sí | Desactiva 2FA (requiere TOTP + password) |

### USUARIOS (/api/users/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/users | GET | Sí | super_admin, company_admin | Lista usuarios |
| /api/users | POST | Sí | super_admin, company_admin | Crea usuario |
| /api/users/[id] | GET | Sí | Según rol | Obtiene usuario |
| /api/users/[id] | PUT | Sí | Según rol | Actualiza usuario |
| /api/users/[id] | DELETE | Sí | super_admin | Elimina usuario |

### EMPRESAS (/api/companies/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/companies | GET | Sí | super_admin | Lista empresas |
| /api/companies | POST | Sí | super_admin | Crea empresa |
| /api/companies/[id] | GET | Sí | super_admin, company_admin(propia) | Obtiene empresa |
| /api/companies/[id] | PUT | Sí | super_admin | Actualiza empresa |
| /api/companies/[id] | DELETE | Sí | super_admin | Elimina empresa |

### CUENTAS CLABE (/api/clabe-accounts/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/clabe-accounts | GET | Sí | Según rol | Lista CLABEs accesibles |
| /api/clabe-accounts | POST | Sí | super_admin, company_admin | Crea CLABE manual |
| /api/clabe-accounts/generate | POST | Sí | super_admin, company_admin | Genera CLABE virtual vía OPM |
| /api/clabe-accounts/[id] | GET | Sí | Con acceso | Obtiene CLABE |
| /api/clabe-accounts/[id] | PUT | Sí | super_admin, company_admin | Actualiza CLABE |
| /api/clabe-accounts/[id] | DELETE | Sí | super_admin | Elimina CLABE |

### ÓRDENES SPEI (/api/orders/*) - CRÍTICO
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/orders | POST | Sí | Con acceso CLABE | ⚠️ Crea transferencia SPEI |
| /api/orders | GET | Sí | super_admin, company_admin | Lista órdenes OPM |
| /api/orders/[id] | GET | Sí | super_admin, company_admin | Obtiene orden OPM |
| /api/orders/[id] | DELETE | Sí | super_admin | Cancela orden |
| /api/orders/[id]/cancel | POST | Sí | Creador | Cancela en grace period |
| /api/orders/[id]/cancel | GET | Sí | Creador | Verifica si puede cancelarse |
| /api/orders/[id]/notify | POST | No | - | Reenvía webhook |
| /api/orders/[id]/cep | GET | No | - | Obtiene URL CEP |
| /api/orders/status | GET | No | - | Estado por tracking key |
| /api/orders/confirm-pending | POST | No | Sistema/cron | Procesa pendientes post-grace |

### TRANSACCIONES (/api/transactions)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/transactions | GET | Sí | Según acceso CLABE | Lista transacciones con filtros |

### BALANCE Y DASHBOARD
| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| /api/balance | GET/POST | Sí | Balance de CLABE (requiere acceso) |
| /api/dashboard | GET | Sí | Estadísticas (filtradas por acceso) |

### CUENTAS GUARDADAS (/api/saved-accounts/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/saved-accounts | GET | Sí | Usuario | Lista sus cuentas guardadas |
| /api/saved-accounts | POST | Sí | Usuario | Crea cuenta guardada |
| /api/saved-accounts/[id] | GET/PUT/DELETE | Sí | Propietario | CRUD cuenta guardada |

### COMISIONES (/api/commissions/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/commissions/cutoff | GET | Sí | super_admin | Ver estado comisiones |
| /api/commissions/cutoff | POST | Sí/Cron | super_admin o cron secret | Ejecuta corte |

### CLIENTES OPM (/api/clients/*)
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/clients | GET | Sí | super_admin, company_admin | Lista clientes OPM |
| /api/clients | POST | Sí | super_admin, company_admin | Crea cliente OPM |
| /api/clients/[id] | PUT | No* | - | Actualiza cliente |
| /api/clients/[id] | PATCH | No* | - | Cambia estado cliente |

### WEBHOOKS (/api/webhooks/*) - Reciben datos de OPM
| Endpoint | Método | Auth | Validación | Descripción |
|----------|--------|------|------------|-------------|
| /api/webhooks/deposit | POST | No | IP whitelist + RSA | Recibe depósitos SPEI entrantes |
| /api/webhooks/order-status | POST | No | IP whitelist | Cambios de estado de órdenes |
| /api/webhooks/cash | POST | No | - | Cobranzas en efectivo |

### DATOS DE REFERENCIA
| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| /api/banks | GET | No | Lista bancos SPEI |
| /api/account-types | GET | No | Tipos de cuenta (40=CLABE, etc.) |
| /api/payment-types | GET | No | Tipos de pago |

### ADMINISTRACIÓN
| Endpoint | Método | Auth | Roles | Descripción |
|----------|--------|------|-------|-------------|
| /api/admin/cleanup-users | GET/POST | Sí | super_admin | Limpia usuarios (excepto super_admin) |
| /api/admin/sync-transactions | GET/POST | Sí | super_admin | Sincroniza con OPM |
| /api/debug/probe-opm | POST | No* | dev only | Prueba endpoints OPM |

---

## REGLAS DE SEGURIDAD IMPLEMENTADAS

### 1. SALDO POR CLABE
- Cada cuenta CLABE tiene saldo independiente
- Fórmula: incoming(scattered) - outgoing(sent,scattered) - in_transit
- Validación atómica previene enviar más del saldo disponible

### 2. MULTI-TENANT (Aislamiento de Empresas)
- super_admin: acceso total
- company_admin: solo su empresa
- user: solo CLABEs asignadas en user_clabe_access

### 3. AUTENTICACIÓN
- Sesiones de 24 horas con token en BD
- Rate limiting: 5 intentos fallidos = bloqueo 15 min
- Account lockout: 30 min después de 5 intentos fallidos
- 2FA TOTP obligatorio para operaciones sensibles

### 4. TRANSFERENCIAS SPEI
- Requiere autenticación + acceso a CLABE origen
- 2FA obligatorio si está habilitado
- Validación atómica de saldo (SERIALIZABLE + FOR UPDATE NOWAIT)
- Grace period de 8 segundos antes de enviar a OPM
- Tracking key único previene duplicados

### 5. TOKENS Y CRIPTOGRAFÍA
- IDs: crypto.randomUUID() (no predecibles)
- Tokens reset: 256 bits (64 chars hex)
- Passwords: bcrypt 12 rounds
- TOTP: crypto.timingSafeEqual (previene timing attacks)
- Firmas OPM: RSA-SHA256

### 6. AUDIT LOGS
- Todas las acciones críticas se registran
- Incluye: userId, email, IP, userAgent, severity
- Severidades: info, warning, critical

---

## TAREA PENDIENTE: FIRMA CRIPTOGRÁFICA DE TRANSACCIONES

Se necesita implementar un sistema donde CADA transacción tenga:

1. **Firma única** (HMAC-SHA256) que incluya:
   - Transaction ID
   - Monto
   - CLABE origen
   - CLABE destino
   - Timestamp
   - Nonce único

2. **Idempotency Key** para garantizar que:
   - Si hay error de red con OPM, no se duplique
   - Si el servidor se reinicia, no se envíe doble
   - Un atacante no pueda replay una transacción

3. **Estados de transacción**:
   - created → firma generada, no enviada
   - submitted → enviada a OPM
   - confirmed → OPM confirmó
   - completed → CEP recibido
   - failed → error final
   - duplicate_prevented → intento de duplicado bloqueado

4. **Verificación antes de enviar a OPM**:
   - No exista transacción con misma firma en 24h
   - tracking_key no se haya usado
   - idempotency_key no exista

---

## VARIABLES DE ENTORNO REQUERIDAS

```
DATABASE_URL=postgresql://...
OPM_API_KEY=...
OPM_BASE_URL=https://api.opm.mx
OPM_PRIVATE_KEY=... (Base64 o PEM)
OPM_PUBLIC_KEY=... (Base64 o PEM)
INITIAL_ADMIN_PASSWORD=... (mínimo 12 caracteres)
ALLOWED_ORIGINS=https://tudominio.com,https://admin.tudominio.com
```

---

**IMPORTANTE**: Al agregar mejoras de seguridad, NO modificar la lógica de:
- createOutgoingTransactionAtomic()
- getClabeAccountBalance()
- validateClabeAccess()
- La fórmula de cálculo de saldo
- El control de acceso multi-tenant
