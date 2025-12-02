# NOVACORE - Core Bancario Futurista

Sistema bancario moderno con integracion SPEI (Sistema de Pagos Electronicos Interbancarios) de Mexico.

**Dominio**: https://novacorp.mx

## Caracteristicas

- Dashboard interactivo con estadisticas en tiempo real
- Transferencias SPEI de entrada y salida
- Gestion de clientes (Participantes Indirectos)
- Historial de transacciones con filtros avanzados
- Webhooks para notificaciones automaticas
- Interfaz futurista con animaciones modernas
- Colores neon y efectos glassmorphism

## Tecnologias

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Animaciones**: Framer Motion
- **Graficos**: Recharts
- **Estado**: Zustand
- **Deploy**: AWS EC2 (Ubuntu) + PM2 + Nginx
- **Base de datos**: AWS RDS PostgreSQL

## Integracion API OPM/Transfer

Este sistema integra la API de OPM/Transfer para operaciones SPEI:

### Endpoints Implementados

- `POST /api/orders` - Crear orden de transferencia
- `GET /api/orders` - Listar ordenes
- `POST /api/balance` - Consultar saldo
- `GET /api/banks` - Listar bancos

### Webhooks

- `/api/webhooks/deposit` - Recibe notificaciones de depositos SPEI
- `/api/webhooks/order-status` - Recibe cambios de estado en ordenes

## Configuracion

### Variables de Entorno

Crea un archivo `.env.local` basado en `.env.example`:

\`\`\`env
# OPM API Configuration
NEXT_PUBLIC_OPM_API_URL=https://apiuat.opm.mx
OPM_API_KEY=your_api_key_here

# RSA Keys (Base64 encoded)
OPM_PRIVATE_KEY=your_private_key_base64
OPM_PUBLIC_KEY=your_public_key_base64

# Default Payer Configuration
DEFAULT_PAYER_ACCOUNT=684180017000000001
DEFAULT_PAYER_BANK=90684
DEFAULT_PAYER_NAME=NOVACORE SA DE CV
\`\`\`

## Instalacion

\`\`\`bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Construir para produccion
npm run build

# Iniciar en produccion
npm start
\`\`\`

## Estructura del Proyecto

\`\`\`
src/
├── app/                    # Next.js App Router
│   ├── (app)/             # Rutas protegidas con layout
│   │   ├── dashboard/     # Dashboard principal
│   │   ├── transfers/     # Transferencias SPEI
│   │   ├── history/       # Historial de transacciones
│   │   ├── clients/       # Gestion de clientes
│   │   └── settings/      # Configuracion
│   └── api/               # API Routes
│       ├── webhooks/      # Webhooks OPM
│       ├── orders/        # Ordenes SPEI
│       ├── balance/       # Consulta de saldo
│       └── banks/         # Lista de bancos
├── components/
│   ├── ui/                # Componentes UI reutilizables
│   ├── layout/            # Layout y navegacion
│   └── dashboard/         # Componentes del dashboard
├── lib/                   # Utilidades y servicios
│   ├── opm-api.ts        # Cliente API OPM
│   ├── crypto.ts         # Firma RSA
│   └── utils.ts          # Funciones utilitarias
├── store/                 # Estado global (Zustand)
└── types/                 # Tipos TypeScript
\`\`\`

## Deploy en AWS EC2

El sistema esta desplegado en AWS EC2 con la siguiente configuracion:

- **Servidor**: AWS EC2 (Ubuntu)
- **Base de datos**: AWS RDS PostgreSQL
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx
- **Dominio**: novacorp.mx (IP: 18.116.134.188)

### Comandos utiles

```bash
# Ver logs de la aplicacion
pm2 logs novacore

# Reiniciar aplicacion
pm2 restart novacore

# Ver estado
pm2 status

# Rebuild y restart
cd /home/ubuntu/NOVACORE && npm run build && pm2 restart novacore
```

### Logs de Webhooks

Los webhooks loguean toda la informacion recibida. Para ver los logs:
```bash
pm2 logs novacore --lines 100
```

## Seguridad

- Todas las firmas RSA se generan server-side
- Verificacion de firma en webhooks
- Validacion de CLABE con digito verificador
- Sanitizacion de datos para SPEI (sin acentos)

## Licencia

MIT
