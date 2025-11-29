'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Modal,
} from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { Client } from '@/types';

// Demo clients
const demoClients: (Client & { virtualAccountNumber: string })[] = [
  {
    id: '1',
    virtualAccountNumber: '684180017000000012',
    name: 'JUAN',
    lastName: 'PEREZ',
    secondLastName: 'MARTINEZ',
    businessName: '',
    rfc: 'PEMJ850101ABC',
    curp: 'PEMJ850101HDFRRT09',
    address: 'AV REFORMA 123, COL CENTRO, CDMX',
    email: 'juan.perez@email.com',
    mobileNumber: '5512345678',
    birthDate: '1985-01-01',
    gender: 'M',
    state: 'CIUDAD DE MEXICO',
    country: 'MEXICO',
    nationality: 'MEXICANA',
    status: 'ACTIVE',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
  {
    id: '2',
    virtualAccountNumber: '684180017000000023',
    name: 'MARIA',
    lastName: 'GARCIA',
    secondLastName: 'LOPEZ',
    businessName: '',
    rfc: 'GALM900215XYZ',
    curp: 'GALM900215MDFRRS01',
    address: 'CALLE PRINCIPAL 456, COL ROMA, CDMX',
    email: 'maria.garcia@email.com',
    mobileNumber: '5598765432',
    birthDate: '1990-02-15',
    gender: 'F',
    state: 'CIUDAD DE MEXICO',
    country: 'MEXICO',
    nationality: 'MEXICANA',
    status: 'ACTIVE',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
  },
  {
    id: '3',
    virtualAccountNumber: '684180017000000034',
    name: 'CRYPTO EXCHANGE MX',
    lastName: '',
    secondLastName: '',
    businessName: 'CRYPTO EXCHANGE MX SA DE CV',
    rfc: 'CEM200101AAA',
    curp: '',
    address: 'TORRE REFORMA 500, PISO 20, CDMX',
    email: 'contacto@cryptoexchange.mx',
    mobileNumber: '5500000000',
    birthDate: '2020-01-01',
    gender: 'M',
    state: 'CIUDAD DE MEXICO',
    country: 'MEXICO',
    nationality: 'MEXICANA',
    status: 'ACTIVE',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
  },
  {
    id: '4',
    virtualAccountNumber: '684180017000000045',
    name: 'CARLOS',
    lastName: 'RODRIGUEZ',
    secondLastName: 'HERNANDEZ',
    businessName: '',
    rfc: 'ROHC880520DEF',
    curp: 'ROHC880520HDFRRL05',
    address: 'AV INSURGENTES 789, COL CONDESA, CDMX',
    email: 'carlos.rodriguez@email.com',
    mobileNumber: '5544332211',
    birthDate: '1988-05-20',
    gender: 'M',
    state: 'CIUDAD DE MEXICO',
    country: 'MEXICO',
    nationality: 'MEXICANA',
    status: 'BLOCKED',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 90,
  },
  {
    id: '5',
    virtualAccountNumber: '684180017000000056',
    name: 'ANA',
    lastName: 'MARTINEZ',
    secondLastName: 'SANCHEZ',
    businessName: '',
    rfc: 'MASA950830GHI',
    curp: 'MASA950830MDFRNN08',
    address: 'CALLE SECUNDARIA 321, COL POLANCO, CDMX',
    email: 'ana.martinez@email.com',
    mobileNumber: '5566778899',
    birthDate: '1995-08-30',
    gender: 'F',
    state: 'CIUDAD DE MEXICO',
    country: 'MEXICO',
    nationality: 'MEXICANA',
    status: 'INACTIVE',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
  },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'BLOCKED', label: 'Bloqueado' },
  { value: 'CANCELED', label: 'Cancelado' },
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'warning';
    case 'BLOCKED':
      return 'danger';
    case 'CANCELED':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'INACTIVE':
      return 'Inactivo';
    case 'BLOCKED':
      return 'Bloqueado';
    case 'CANCELED':
      return 'Cancelado';
    default:
      return status;
  }
};

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedClient, setSelectedClient] = useState<(typeof demoClients)[0] | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  const filteredClients = demoClients.filter((client) => {
    const fullName = `${client.name} ${client.lastName} ${client.secondLastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.virtualAccountNumber.includes(searchQuery);

    const matchesStatus = !statusFilter || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openDetail = (client: (typeof demoClients)[0]) => {
    setSelectedClient(client);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-white">
            Gestion de Clientes
          </h1>
          <p className="text-gray-400 mt-1">
            Administra las cuentas de participantes indirectos
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowNewClientModal(true)}>
          Nuevo Cliente
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Clientes', value: demoClients.length, icon: Users, color: 'text-white' },
          {
            label: 'Activos',
            value: demoClients.filter((c) => c.status === 'ACTIVE').length,
            icon: CheckCircle,
            color: 'text-green-400',
          },
          {
            label: 'Inactivos',
            value: demoClients.filter((c) => c.status === 'INACTIVE').length,
            icon: Clock,
            color: 'text-yellow-400',
          },
          {
            label: 'Bloqueados',
            value: demoClients.filter((c) => c.status === 'BLOCKED').length,
            icon: XCircle,
            color: 'text-red-400',
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-xl bg-dark-700 border border-white/5 flex items-center gap-4"
            >
              <div className="p-3 rounded-lg bg-dark-600">
                <Icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <Card variant="glass">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder="Buscar por nombre, RFC, email o CLABE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                variant="glass"
              />
            </div>
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              variant="glass"
            />
          </div>
        </div>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client, index) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              variant="default"
              className="cursor-pointer group"
              onClick={() => openDetail(client)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                        client.businessName
                          ? 'bg-accent-primary/20 text-accent-primary'
                          : 'bg-neon-cyan/20 text-neon-cyan'
                      )}
                    >
                      {client.businessName ? (
                        <Building2 className="w-6 h-6" />
                      ) : (
                        client.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-neon-cyan transition-colors">
                        {client.businessName || `${client.name} ${client.lastName}`}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono">{client.rfc}</p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(client.status)} size="sm">
                    {getStatusText(client.status)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{client.mobileNumber}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">CLABE Virtual</p>
                      <p className="font-mono text-sm text-neon-cyan">
                        {client.virtualAccountNumber}
                      </p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No se encontraron clientes</p>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle del Cliente"
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-700">
              <div
                className={cn(
                  'w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold',
                  selectedClient.businessName
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-neon-cyan/20 text-neon-cyan'
                )}
              >
                {selectedClient.businessName ? (
                  <Building2 className="w-8 h-8" />
                ) : (
                  selectedClient.name.charAt(0)
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white">
                  {selectedClient.businessName ||
                    `${selectedClient.name} ${selectedClient.lastName} ${selectedClient.secondLastName}`}
                </h3>
                <p className="text-gray-400 font-mono">{selectedClient.rfc}</p>
              </div>
              <Badge variant={getStatusVariant(selectedClient.status)} size="lg">
                {getStatusText(selectedClient.status)}
              </Badge>
            </div>

            {/* CLABE */}
            <div className="p-4 rounded-xl bg-dark-700 border border-neon-cyan/30">
              <p className="text-xs text-gray-500 mb-1">Cuenta CLABE Virtual</p>
              <p className="font-mono text-2xl text-neon-cyan text-glow-cyan">
                {selectedClient.virtualAccountNumber.replace(/(\d{3})(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5')}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-white">{selectedClient.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Telefono</p>
                    <p className="text-white">{selectedClient.mobileNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Fecha de Nacimiento</p>
                    <p className="text-white">{selectedClient.birthDate}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Direccion</p>
                    <p className="text-white text-sm">{selectedClient.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">CURP</p>
                    <p className="text-white font-mono">{selectedClient.curp || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button variant="secondary" className="flex-1" leftIcon={<Edit className="w-4 h-4" />}>
                Editar
              </Button>
              <Button variant="ghost" className="flex-1" leftIcon={<Eye className="w-4 h-4" />}>
                Ver Transacciones
              </Button>
              {selectedClient.status !== 'BLOCKED' && (
                <Button
                  variant="danger"
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Bloquear
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New Client Modal */}
      <Modal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        title="Nuevo Cliente"
        description="Registrar cuenta de participante indirecto"
        size="xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Nombre(s)" placeholder="JUAN" variant="glass" />
            <Input label="Apellido Paterno" placeholder="PEREZ" variant="glass" />
            <Input label="Apellido Materno" placeholder="MARTINEZ" variant="glass" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="RFC" placeholder="PEMJ850101ABC" variant="glass" maxLength={13} />
            <Input label="CURP" placeholder="PEMJ850101HDFRRT09" variant="glass" maxLength={18} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Email" type="email" placeholder="email@ejemplo.com" variant="glass" />
            <Input label="Telefono" placeholder="5512345678" variant="glass" maxLength={10} />
          </div>

          <Input label="Direccion" placeholder="Calle, Numero, Colonia, Ciudad" variant="glass" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Fecha de Nacimiento" type="date" variant="glass" />
            <Select
              label="Genero"
              options={[
                { value: 'M', label: 'Masculino' },
                { value: 'F', label: 'Femenino' },
              ]}
              variant="glass"
            />
            <Input label="Estado" placeholder="CIUDAD DE MEXICO" variant="glass" />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setShowNewClientModal(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" leftIcon={<Plus className="w-4 h-4" />}>
              Crear Cliente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
