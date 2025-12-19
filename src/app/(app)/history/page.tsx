'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  X,
  Filter,
  Building2,
  DollarSign,
  RefreshCw,
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
import { NovacorpLogo } from '@/components/ui/NovacorpLogo';
import { formatCurrency, formatDate, getStatusText, cn, formatClabe } from '@/lib/utils';
import { getBankFromSpeiCode, getBankSelectOptions } from '@/lib/banks';
import { generateReceiptPDF } from '@/lib/generate-receipt-pdf';

interface Transaction {
  id: string;
  clabeAccountId: string | null;
  type: 'incoming' | 'outgoing';
  status: string;
  amount: number;
  concept: string | null;
  trackingKey: string;
  numericalReference: number | null;
  beneficiaryAccount: string | null;
  beneficiaryBank: string | null;
  beneficiaryName: string | null;
  beneficiaryUid: string | null;
  payerAccount: string | null;
  payerBank: string | null;
  payerName: string | null;
  payerUid: string | null;
  opmOrderId: string | null;
  errorDetail: string | null;
  cepUrl: string | null;
  createdAt: number;
  updatedAt: number;
  settledAt: number | null;
}

interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    itemsPerPage: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalCount: number;
    totalIncoming: number;
    totalOutgoing: number;
    inTransit: number;
  };
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending_confirmation', label: 'En espera (20s)' },
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
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({ totalCount: 0, totalIncoming: 0, totalOutgoing: 0, inTransit: 0 });
  const [pagination, setPagination] = useState({ page: 1, itemsPerPage: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clabeFilter, setClabeFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modal state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // CEP state
  const [loadingCep, setLoadingCep] = useState(false);

  // Fetch CEP from Banxico
  const handleGetCep = async (transaction: Transaction) => {
    if (!transaction.opmOrderId) {
      alert('Esta transacción no tiene ID de orden OPM');
      return;
    }

    setLoadingCep(true);
    try {
      const response = await fetch(`/api/orders/${transaction.opmOrderId}/cep`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener CEP');
      }

      // OPM returns the CEP URL in the response
      if (data.data?.cepUrl || data.cepUrl) {
        const cepUrl = data.data?.cepUrl || data.cepUrl;
        window.open(cepUrl, '_blank');
      } else {
        alert('CEP no disponible aún. Por favor intenta más tarde.');
      }
    } catch (error) {
      console.error('CEP error:', error);
      alert(error instanceof Error ? error.message : 'Error al obtener CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('itemsPerPage', pagination.itemsPerPage.toString());

      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (bankFilter) {
        // Apply to both beneficiary and payer bank
        params.append('beneficiaryBank', bankFilter);
      }
      if (minAmount) params.append('minAmount', minAmount);
      if (maxAmount) params.append('maxAmount', maxAmount);
      if (dateFrom) params.append('from', new Date(dateFrom).getTime().toString());
      if (dateTo) params.append('to', new Date(dateTo + 'T23:59:59').getTime().toString());
      if (clabeFilter) {
        params.append('beneficiaryAccount', clabeFilter);
        params.append('payerAccount', clabeFilter);
      }

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) {
        throw new Error('Error al cargar transacciones');
      }

      const data: TransactionResponse = await response.json();
      setTransactions(data.transactions);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.itemsPerPage, searchQuery, statusFilter, typeFilter, bankFilter, minAmount, maxAmount, dateFrom, dateTo, clabeFilter]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setTypeFilter('');
    setBankFilter('');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
    setClabeFilter('');
    handleFilterChange();
  };

  // Has active filters?
  const hasActiveFilters = searchQuery || statusFilter || typeFilter || bankFilter || minAmount || maxAmount || dateFrom || dateTo || clabeFilter;

  // Open detail modal
  const openDetail = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setShowDetailModal(true);
  };

  // Get bank name from code
  const getBankName = (bankCode: string | null): string => {
    if (!bankCode) return '-';
    const bank = getBankFromSpeiCode(bankCode);
    return bank?.shortName || bankCode;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Bank options
  const bankOptions = [{ value: '', label: 'Todos los bancos' }, ...getBankSelectOptions()];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-white/90">Historial</h1>
          <p className="text-sm text-white/40 mt-1">Consulta todas tus operaciones</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTransactions}
            leftIcon={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
          >
            Actualizar
          </Button>
          <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.04] rounded-lg overflow-hidden">
        {[
          { label: 'Transacciones', value: stats.totalCount.toLocaleString() },
          { label: 'Entradas', value: formatCurrency(stats.totalIncoming), isPositive: true },
          { label: 'Salidas', value: formatCurrency(stats.totalOutgoing) },
          { label: 'En Transito', value: formatCurrency(stats.inTransit), isWarning: true },
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
        <div className="space-y-4">
          {/* Main filters row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por clave, nombre, concepto..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); handleFilterChange(); }}
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }}
            />
            <Button
              variant={showAdvancedFilters ? 'secondary' : 'ghost'}
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              Filtros
              <ChevronDown className={cn('w-4 h-4 ml-1 transition-transform', showAdvancedFilters && 'rotate-180')} />
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="w-4 h-4" />}>
                Limpiar
              </Button>
            )}
          </div>

          {/* Advanced filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.06]">
              {/* Date range */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Desde</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
                  leftIcon={<Calendar className="w-4 h-4" />}
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Hasta</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
                  leftIcon={<Calendar className="w-4 h-4" />}
                />
              </div>

              {/* Amount range */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Monto minimo</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => { setMinAmount(e.target.value); handleFilterChange(); }}
                  leftIcon={<DollarSign className="w-4 h-4" />}
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Monto maximo</label>
                <Input
                  type="number"
                  placeholder="999,999.99"
                  value={maxAmount}
                  onChange={(e) => { setMaxAmount(e.target.value); handleFilterChange(); }}
                  leftIcon={<DollarSign className="w-4 h-4" />}
                />
              </div>

              {/* Bank filter */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Banco</label>
                <Select
                  options={bankOptions}
                  value={bankFilter}
                  onChange={(e) => { setBankFilter(e.target.value); handleFilterChange(); }}
                />
              </div>

              {/* CLABE filter */}
              <div className="md:col-span-3">
                <label className="block text-xs text-white/40 mb-1.5">Cuenta CLABE</label>
                <Input
                  placeholder="Buscar por CLABE (parcial o completa)"
                  value={clabeFilter}
                  onChange={(e) => { setClabeFilter(e.target.value); handleFilterChange(); }}
                  leftIcon={<Building2 className="w-4 h-4" />}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 mx-auto text-white/20 animate-spin mb-3" />
          <p className="text-white/40 text-sm">Cargando transacciones...</p>
        </div>
      )}

      {/* Transactions Table */}
      {!isLoading && transactions.length > 0 && (
        <>
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
              {transactions.map((tx) => (
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
                      <p className="text-xs text-white/30">
                        {getBankName(tx.type === 'incoming' ? tx.payerBank : tx.beneficiaryBank)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-white/50">{tx.concept || '-'}</span>
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
                          : tx.status === 'pending' || tx.status === 'sent' || tx.status === 'pending_confirmation'
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
                    <span className="text-xs text-white/40">{formatDate(tx.createdAt)}</span>
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

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/40">
              Mostrando {((pagination.page - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.page * pagination.itemsPerPage, pagination.total)} de {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!isLoading && transactions.length === 0 && (
        <div className="text-center py-12">
          <History className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <p className="text-white/40 text-sm">
            {hasActiveFilters ? 'No se encontraron transacciones con los filtros aplicados' : 'No hay transacciones aun'}
          </p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="mt-4" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title=""
        size="md"
      >
        {selectedTransaction && (
          <div className="space-y-6">
            {/* Logo Header */}
            <div className="flex flex-col items-center pt-2 pb-4 border-b border-white/[0.06]">
              <NovacorpLogo size="lg" />
              <p className="text-xs text-white/40 mt-3">Comprobante de Operacion</p>
            </div>

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
              <div className="col-span-2 p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Clave de Rastreo</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-white/70 break-all">{selectedTransaction.trackingKey}</p>
                  <button
                    className="p-1 hover:bg-white/5 rounded flex-shrink-0"
                    onClick={() => copyToClipboard(selectedTransaction.trackingKey)}
                  >
                    <Copy className="w-3 h-3 text-white/30" />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Fecha y Hora</p>
                <p className="text-sm text-white/70">{formatDate(selectedTransaction.createdAt)}</p>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Banco {selectedTransaction.type === 'incoming' ? 'Ordenante' : 'Beneficiario'}</p>
                <p className="text-sm text-white/70">
                  {getBankName(selectedTransaction.type === 'incoming' ? selectedTransaction.payerBank : selectedTransaction.beneficiaryBank)}
                </p>
              </div>
              <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                <p className="text-xs text-white/30 mb-1">Concepto</p>
                <p className="text-sm text-white/70">{selectedTransaction.concept || '-'}</p>
              </div>
              {selectedTransaction.beneficiaryAccount && (
                <div className="col-span-2 p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/30 mb-1">CLABE Beneficiario</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm text-white/70">{formatClabe(selectedTransaction.beneficiaryAccount)}</p>
                    <button
                      className="p-1 hover:bg-white/5 rounded"
                      onClick={() => copyToClipboard(selectedTransaction.beneficiaryAccount!)}
                    >
                      <Copy className="w-3 h-3 text-white/30" />
                    </button>
                  </div>
                </div>
              )}
              {selectedTransaction.payerAccount && (
                <div className="col-span-2 p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/30 mb-1">CLABE Ordenante</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm text-white/70">{formatClabe(selectedTransaction.payerAccount)}</p>
                    <button
                      className="p-1 hover:bg-white/5 rounded"
                      onClick={() => copyToClipboard(selectedTransaction.payerAccount!)}
                    >
                      <Copy className="w-3 h-3 text-white/30" />
                    </button>
                  </div>
                </div>
              )}
              {selectedTransaction.numericalReference && (
                <div className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-xs text-white/30 mb-1">Referencia Numerica</p>
                  <p className="font-mono text-sm text-white/70">{selectedTransaction.numericalReference}</p>
                </div>
              )}
              {selectedTransaction.errorDetail && (
                <div className="col-span-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400/70 mb-1">Detalle de Error</p>
                  <p className="text-sm text-red-400/90">{selectedTransaction.errorDetail}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.06]">
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  leftIcon={<Copy className="w-4 h-4" />}
                  onClick={() => {
                    const data = `Clave: ${selectedTransaction.trackingKey}\nMonto: ${formatCurrency(selectedTransaction.amount)}\nBeneficiario: ${selectedTransaction.beneficiaryName || selectedTransaction.payerName}`;
                    copyToClipboard(data);
                  }}
                >
                  Copiar Datos
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => generateReceiptPDF(selectedTransaction)}
                >
                  Descargar Comprobante
                </Button>
              </div>
              {selectedTransaction.status === 'scattered' && selectedTransaction.type === 'outgoing' && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => handleGetCep(selectedTransaction)}
                  disabled={loadingCep}
                  leftIcon={loadingCep ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                >
                  {loadingCep ? 'Obteniendo...' : 'Obtener CEP de Banxico'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
