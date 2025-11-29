'use client';

import { useState } from 'react';
import {
  History,
  Search,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronDown,
  Copy,
  Eye,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
} from '@/components/ui';
import { formatCurrency, formatDate, getStatusText, cn } from '@/lib/utils';
import { Transaction } from '@/types';

const demoTransactions: Transaction[] = [
  {
    id: '1',
    type: 'incoming',
    amount: 150000,
    status: 'scattered',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'CRYPTO EXCHANGE MX SA DE CV',
    concept: 'DEPOSITO FONDOS CRIPTO',
    trackingKey: 'NC2024112900001',
    date: new Date(Date.now() - 1000 * 60 * 30),
    bank: 'BBVA',
  },
  {
    id: '2',
    type: 'outgoing',
    amount: 85000,
    status: 'scattered',
    beneficiaryName: 'JUAN PEREZ MARTINEZ',
    payerName: 'NOVACORE SA DE CV',
    concept: 'DISPERSION NOMINA NOV24',
    trackingKey: 'NC2024112900002',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2),
    bank: 'SANTANDER',
  },
  {
    id: '3',
    type: 'outgoing',
    amount: 45000,
    status: 'sent',
    beneficiaryName: 'MARIA GARCIA LOPEZ',
    payerName: 'NOVACORE SA DE CV',
    concept: 'PAGO PROVEEDOR',
    trackingKey: 'NC2024112900003',
    date: new Date(Date.now() - 1000 * 60 * 60 * 5),
    bank: 'BANORTE',
  },
  {
    id: '4',
    type: 'incoming',
    amount: 25000,
    status: 'scattered',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'CLIENTE DEMO SA',
    concept: 'PAGO SERVICIOS',
    trackingKey: 'NC2024112900004',
    date: new Date(Date.now() - 1000 * 60 * 60 * 8),
    bank: 'HSBC',
  },
  {
    id: '5',
    type: 'outgoing',
    amount: 12500,
    status: 'pending',
    beneficiaryName: 'PROVEEDOR TECH',
    payerName: 'NOVACORE SA DE CV',
    concept: 'FACTURA 2024-001234',
    trackingKey: 'NC2024112900005',
    date: new Date(Date.now() - 1000 * 60 * 60 * 12),
    bank: 'BANAMEX',
  },
  {
    id: '6',
    type: 'incoming',
    amount: 5000,
    status: 'returned',
    beneficiaryName: 'NOVACORE SA DE CV',
    payerName: 'CUENTA INEXISTENTE',
    concept: 'DEVOLUCION AUTOMATICA',
    trackingKey: 'NC2024112900006',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    bank: 'NU MEXICO',
  },
];

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'sent', label: 'Enviada' },
  { value: 'scattered', label: 'Liquidada' },
  { value: 'returned', label: 'Devuelta' },
  { value: 'canceled', label: 'Cancelada' },
];

const typeOptions = [
  { value: '', label: 'Todas' },
  { value: 'incoming', label: 'Entradas' },
  { value: 'outgoing', label: 'Salidas' },
];

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredTransactions = demoTransactions.filter((tx) => {
    const matchesSearch =
      tx.trackingKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.concept.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || tx.status === statusFilter;
    const matchesType = !typeFilter || tx.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const openDetail = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-white/90">Historial</h1>
          <p className="text-sm text-white/40 mt-1">Consulta todas tus operaciones</p>
        </div>
        <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
          Exportar
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        {[
          { label: 'Transacciones', value: '1,248' },
          { label: 'Entradas', value: formatCurrency(2500000), isPositive: true },
          { label: 'Salidas', value: formatCurrency(1800000) },
          { label: 'En Transito', value: formatCurrency(85000), isWarning: true },
        ].map((stat) => (
          <div key={stat.label} className="bg-black/40 p-4">
            <p className="text-xs text-white/30">{stat.label}</p>
            <p className={cn(
              'text-lg font-mono mt-1',
              stat.isPositive ? 'text-green-400/80' : stat.isWarning ? 'text-yellow-400/80' : 'text-white/80'
            )}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por clave, nombre, concepto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Button variant="ghost" leftIcon={<Calendar className="w-4 h-4" />}>
            Fecha
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Transactions Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Clave de Rastreo</TableHead>
            <TableHead>Beneficiario / Ordenante</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTransactions.map((tx) => (
            <TableRow key={tx.id} className="cursor-pointer" onClick={() => openDetail(tx)}>
              <TableCell>
                <div
                  className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center',
                    tx.type === 'incoming'
                      ? 'bg-green-500/10 text-green-400/80'
                      : 'bg-red-500/10 text-red-400/80'
                  )}
                >
                  {tx.type === 'incoming' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm text-white/60">{tx.trackingKey}</span>
              </TableCell>
              <TableCell>
                <div>
                  <p className="text-sm text-white/80">
                    {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName}
                  </p>
                  <p className="text-xs text-white/30">{tx.bank}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-white/50">{tx.concept}</span>
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    'font-mono text-sm',
                    tx.type === 'incoming' ? 'text-green-400/80' : 'text-white/80'
                  )}
                >
                  {tx.type === 'incoming' ? '+' : '-'} {formatCurrency(tx.amount)}
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    tx.status === 'scattered'
                      ? 'success'
                      : tx.status === 'pending' || tx.status === 'sent'
                      ? 'warning'
                      : tx.status === 'returned'
                      ? 'danger'
                      : 'default'
                  }
                >
                  {getStatusText(tx.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-xs text-white/40">{formatDate(tx.date.getTime())}</span>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <History className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">No se encontraron transacciones</p>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Detalle de Transaccion"
        size="md"
      >
        {selectedTransaction && (
          <div className="space-y-6">
            {/* Status Header */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div
                className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center',
                  selectedTransaction.type === 'incoming'
                    ? 'bg-green-500/10 text-green-400/80'
                    : 'bg-red-500/10 text-red-400/80'
                )}
              >
                {selectedTransaction.type === 'incoming' ? (
                  <ArrowDownLeft className="w-6 h-6" />
                ) : (
                  <ArrowUpRight className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/40">
                  {selectedTransaction.type === 'incoming' ? 'Recibido de' : 'Enviado a'}
                </p>
                <p className="text-sm text-white/90">
                  {selectedTransaction.type === 'incoming'
                    ? selectedTransaction.payerName
                    : selectedTransaction.beneficiaryName}
                </p>
              </div>
              <Badge
                variant={
                  selectedTransaction.status === 'scattered'
                    ? 'success'
                    : selectedTransaction.status === 'pending' || selectedTransaction.status === 'sent'
                    ? 'warning'
                    : selectedTransaction.status === 'returned'
                    ? 'danger'
                    : 'default'
                }
                size="md"
              >
                {getStatusText(selectedTransaction.status)}
              </Badge>
            </div>

            {/* Amount */}
            <div className="text-center py-4">
              <p className="text-xs text-white/40 mb-1">Monto</p>
              <p
                className={cn(
                  'text-3xl font-mono',
                  selectedTransaction.type === 'incoming' ? 'text-green-400/80' : 'text-white/90'
                )}
              >
                {selectedTransaction.type === 'incoming' ? '+' : '-'}{' '}
                {formatCurrency(selectedTransaction.amount)}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Clave de Rastreo</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-white/70">{selectedTransaction.trackingKey}</p>
                  <button className="p-1 hover:bg-white/5 rounded">
                    <Copy className="w-3 h-3 text-white/30" />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Fecha y Hora</p>
                <p className="text-sm text-white/70">{formatDate(selectedTransaction.date.getTime())}</p>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Banco</p>
                <p className="text-sm text-white/70">{selectedTransaction.bank}</p>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Concepto</p>
                <p className="text-sm text-white/70">{selectedTransaction.concept}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
              <Button variant="secondary" className="flex-1" leftIcon={<Copy className="w-4 h-4" />}>
                Copiar Datos
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
