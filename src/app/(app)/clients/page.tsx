'use client';

import { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit,
  Eye,
  XCircle,
  Building2,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  CardContent,
  Badge,
  Modal,
} from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { Client } from '@/types';

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
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-white/90">Clientes</h1>
          <p className="text-sm text-white/40 mt-1">Administra cuentas de participantes</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowNewClientModal(true)}>
          Nuevo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        {[
          { label: 'Total', value: demoClients.length },
          { label: 'Activos', value: demoClients.filter((c) => c.status === 'ACTIVE').length, isPositive: true },
          { label: 'Inactivos', value: demoClients.filter((c) => c.status === 'INACTIVE').length, isWarning: true },
          { label: 'Bloqueados', value: demoClients.filter((c) => c.status === 'BLOCKED').length, isDanger: true },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/40 p-4">
            <p className="text-xs text-white/30">{stat.label}</p>
            <p className={cn(
              'text-lg font-mono mt-1',
              stat.isPositive ? 'text-green-400/80' : stat.isWarning ? 'text-yellow-400/80' : stat.isDanger ? 'text-red-400/80' : 'text-white/80'
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Buscar por nombre, RFC, email o CLABE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer hover:bg-white/[0.04] transition-colors"
            onClick={() => openDetail(client)}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-md flex items-center justify-center text-sm',
                      client.businessName
                        ? 'bg-white/[0.06] text-white/60'
                        : 'bg-white/[0.06] text-white/60'
                    )}
                  >
                    {client.businessName ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      client.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm text-white/80">
                      {client.businessName || `${client.name} ${client.lastName}`}
                    </h3>
                    <p className="text-xs text-white/30 font-mono">{client.rfc}</p>
                  </div>
                </div>
                <Badge variant={getStatusVariant(client.status)} size="sm">
                  {getStatusText(client.status)}
                </Badge>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-white/40">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate text-xs">{client.email}</span>
                </div>
                <div className="flex items-center gap-2 text-white/40">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="text-xs">{client.mobileNumber}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-white/30">CLABE Virtual</p>
                <p className="font-mono text-xs text-white/60">
                  {client.virtualAccountNumber}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">No se encontraron clientes</p>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle del Cliente"
        size="md"
      >
        {selectedClient && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div
                className={cn(
                  'w-14 h-14 rounded-lg flex items-center justify-center text-xl',
                  'bg-white/[0.06] text-white/60'
                )}
              >
                {selectedClient.businessName ? (
                  <Building2 className="w-7 h-7" />
                ) : (
                  selectedClient.name.charAt(0)
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg text-white/90">
                  {selectedClient.businessName ||
                    `${selectedClient.name} ${selectedClient.lastName} ${selectedClient.secondLastName}`}
                </h3>
                <p className="text-sm text-white/40 font-mono">{selectedClient.rfc}</p>
              </div>
              <Badge variant={getStatusVariant(selectedClient.status)} size="md">
                {getStatusText(selectedClient.status)}
              </Badge>
            </div>

            {/* CLABE */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
              <p className="text-xs text-white/30 mb-1">Cuenta CLABE Virtual</p>
              <p className="font-mono text-xl text-white/90">
                {selectedClient.virtualAccountNumber.replace(/(\d{3})(\d{3})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5')}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-xs text-white/30">Email</p>
                    <p className="text-sm text-white/80">{selectedClient.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-xs text-white/30">Telefono</p>
                    <p className="text-sm text-white/80">{selectedClient.mobileNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-xs text-white/30">Fecha de Nacimiento</p>
                    <p className="text-sm text-white/80">{selectedClient.birthDate}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-xs text-white/30">Direccion</p>
                    <p className="text-sm text-white/80">{selectedClient.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-xs text-white/30">CURP</p>
                    <p className="text-sm text-white/80 font-mono">{selectedClient.curp || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
              <Button variant="secondary" className="flex-1" leftIcon={<Edit className="w-4 h-4" />}>
                Editar
              </Button>
              <Button variant="ghost" className="flex-1" leftIcon={<Eye className="w-4 h-4" />}>
                Transacciones
              </Button>
              {selectedClient.status !== 'BLOCKED' && (
                <Button variant="danger" leftIcon={<XCircle className="w-4 h-4" />}>
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
            <Input label="Nombre(s)" placeholder="JUAN" />
            <Input label="Apellido Paterno" placeholder="PEREZ" />
            <Input label="Apellido Materno" placeholder="MARTINEZ" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="RFC" placeholder="PEMJ850101ABC" maxLength={13} />
            <Input label="CURP" placeholder="PEMJ850101HDFRRT09" maxLength={18} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Email" type="email" placeholder="email@ejemplo.com" />
            <Input label="Telefono" placeholder="5512345678" maxLength={10} />
          </div>

          <Input label="Direccion" placeholder="Calle, Numero, Colonia, Ciudad" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Fecha de Nacimiento" type="date" />
            <Select
              label="Genero"
              options={[
                { value: 'M', label: 'Masculino' },
                { value: 'F', label: 'Femenino' },
              ]}
            />
            <Input label="Estado" placeholder="CIUDAD DE MEXICO" />
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
