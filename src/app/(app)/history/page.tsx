'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronDown,
  ExternalLink,
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
import { formatCurrency, formatDate, formatClabe, getStatusText, cn } from '@/lib/utils';
import { Transaction } from '@/types';

// Demo transactions
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-white">
            Historial de Transacciones
          </h1>
          <p className="text-gray-400 mt-1">
            Consulta y exporta todas tus operaciones SPEI
          </p>
        </div>
        <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
          Exportar
        </Button>
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Transacciones', value: '1,248', color: 'text-white' },
          { label: 'Entradas', value: formatCurrency(2500000), color: 'text-green-400' },
          { label: 'Salidas', value: formatCurrency(1800000), color: 'text-red-400' },
          { label: 'En Transito', value: formatCurrency(85000), color: 'text-yellow-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-dark-700 border border-white/5"
          >
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className={cn('text-2xl font-mono font-bold mt-1', stat.color)}>
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card variant="glass">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por clave, nombre, concepto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                variant="glass"
              />
            </div>
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              variant="glass"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              variant="glass"
            />
            <Button variant="ghost" leftIcon={<Calendar className="w-4 h-4" />}>
              Fecha
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
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
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      tx.type === 'incoming'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    )}
                  >
                    {tx.type === 'incoming' ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm text-neon-cyan">{tx.trackingKey}</span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-white">
                      {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName}
                    </p>
                    <p className="text-xs text-gray-500">{tx.bank}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-gray-300">{tx.concept}</span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'font-mono font-medium',
                      tx.type === 'incoming' ? 'text-green-400' : 'text-white'
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
                  <span className="text-sm text-gray-400">{formatDate(tx.date.getTime())}</span>
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
            <History className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">No se encontraron transacciones</p>
          </div>
        )}
      </motion.div>

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
            <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-700">
              <div
                className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center',
                  selectedTransaction.type === 'incoming'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                )}
              >
                {selectedTransaction.type === 'incoming' ? (
                  <ArrowDownLeft className="w-7 h-7" />
                ) : (
                  <ArrowUpRight className="w-7 h-7" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400">
                  {selectedTransaction.type === 'incoming' ? 'Recibido de' : 'Enviado a'}
                </p>
                <p className="text-lg font-semibold text-white">
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
              <p className="text-sm text-gray-400 mb-1">Monto</p>
              <p
                className={cn(
                  'text-4xl font-mono font-bold',
                  selectedTransaction.type === 'incoming' ? 'text-green-400' : 'text-white'
                )}
              >
                {selectedTransaction.type === 'incoming' ? '+' : '-'}{' '}
                {formatCurrency(selectedTransaction.amount)}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-dark-700/50 border border-white/5">
                <p className="text-xs text-gray-500 mb-1">Clave de Rastreo</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-neon-cyan">{selectedTransaction.trackingKey}</p>
                  <button className="p-1 hover:bg-white/5 rounded">
                    <Copy className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-dark-700/50 border border-white/5">
                <p className="text-xs text-gray-500 mb-1">Fecha y Hora</p>
                <p className="text-white">{formatDate(selectedTransaction.date.getTime())}</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-700/50 border border-white/5">
                <p className="text-xs text-gray-500 mb-1">Banco</p>
                <p className="text-white">{selectedTransaction.bank}</p>
              </div>
              <div className="p-3 rounded-lg bg-dark-700/50 border border-white/5">
                <p className="text-xs text-gray-500 mb-1">Concepto</p>
                <p className="text-white">{selectedTransaction.concept}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button variant="secondary" className="flex-1" leftIcon={<Copy className="w-4 h-4" />}>
                Copiar Datos
              </Button>
              {selectedTransaction.status === 'scattered' && (
                <Button variant="ghost" className="flex-1" leftIcon={<ExternalLink className="w-4 h-4" />}>
                  Ver CEP
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
