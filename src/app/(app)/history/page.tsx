'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  X,
  Filter,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
  const { user } = useAuth();

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
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // CEP state
  const [loadingCep, setLoadingCep] = useState(false);

  // Copy helper
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
      if (bankFilter) params.append('beneficiaryBank', bankFilter);
      if (minAmount) params.append('minAmount', minAmount);
      if (maxAmount) params.append('maxAmount', maxAmount);
      if (dateFrom) params.append('from', new Date(dateFrom).getTime().toString());
      if (dateTo) params.append('to', new Date(dateTo + 'T23:59:59').getTime().toString());
      if (clabeFilter) {
        params.append('beneficiaryAccount', clabeFilter);
        params.append('payerAccount', clabeFilter);
      }

      const response = await fetch(`/api/transactions?${params}`, {
        headers: {
          ...(user?.id && { 'x-user-id': user.id }),
        },
      });
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
  }, [pagination.page, pagination.itemsPerPage, searchQuery, statusFilter, typeFilter, bankFilter, minAmount, maxAmount, dateFrom, dateTo, clabeFilter, user?.id]);

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

  // Get bank name from code
  const getBankName = (bankCode: string | null): string => {
    if (!bankCode) return '-';
    const bank = getBankFromSpeiCode(bankCode);
    return bank?.shortName || bankCode;
  };

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scattered':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'sent':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'pending':
      case 'pending_confirmation':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'returned':
      case 'canceled':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Historial</h1>
        <p className="text-white/40 text-sm mt-1">Consulta todas tus operaciones</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60 text-sm">Transacciones</span>
            <button onClick={fetchTransactions} disabled={isLoading} className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.05] rounded transition-colors">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <DollarSign className="w-5 h-5 text-purple-400" />
            <span className="text-2xl font-bold text-white">{isLoading ? '...' : stats.totalCount.toLocaleString()}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-white/60 text-sm">Total Entrante</span>
          </div>
          <div className="flex items-baseline gap-2">
            <ArrowDownLeft className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalIncoming)}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-white/60 text-sm">Total Saliente</span>
          </div>
          <div className="flex items-baseline gap-2">
            <ArrowUpRight className="w-5 h-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400">{formatCurrency(stats.totalOutgoing)}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-white/60 text-sm">En Tránsito</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-yellow-400">{formatCurrency(stats.inTransit)}</span>
          </div>
        </motion.div>
      </div>

      {/* Transactions Section */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Buscar por concepto, clave de rastreo..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); handleFilterChange(); }} className="bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50">
                {typeOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-[#0a0a1a]">{opt.label}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }} className="bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50">
                {statusOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-[#0a0a1a]">{opt.label}</option>)}
              </select>
              <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={cn("p-2.5 border rounded-lg transition-colors", showAdvancedFilters ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.05]")}>
                <Filter className="w-4 h-4" />
              </button>
              <button onClick={() => fetchTransactions()} className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-colors">
                <RefreshCw className={`w-4 h-4 text-white/60 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {showAdvancedFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-white/[0.06]">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Monto mínimo</label>
                <input type="number" placeholder="0.00" value={minAmount} onChange={(e) => { setMinAmount(e.target.value); handleFilterChange(); }} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Monto máximo</label>
                <input type="number" placeholder="999,999.99" value={maxAmount} onChange={(e) => { setMaxAmount(e.target.value); handleFilterChange(); }} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50" />
              </div>
            </div>
          )}
        </div>

        {error && <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">{error}</div>}

        {/* Transactions Table - Updated: Fecha first, Clave Rastreo visible, no Estado */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">Fecha</th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">Tipo</th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">Contraparte</th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">Clave Rastreo</th>
                <th className="text-right text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">Monto</th>
                <th className="text-center text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setSelectedTransaction(tx)}
                >
                  <td className="px-6 py-4">
                    <span className="text-white/60 text-sm">{formatDate(tx.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.type === 'incoming' ? (
                        <div className="p-2 bg-green-500/10 rounded-lg"><ArrowDownLeft className="w-4 h-4 text-green-400" /></div>
                      ) : (
                        <div className="p-2 bg-red-500/10 rounded-lg"><ArrowUpRight className="w-4 h-4 text-red-400" /></div>
                      )}
                      <span className="text-white/60 text-sm">{tx.type === 'incoming' ? 'Entrada' : 'Salida'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-[180px]">{tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName || 'Sin nombre'}</p>
                      <p className="text-white/40 text-xs">{getBankName(tx.type === 'incoming' ? tx.payerBank : tx.beneficiaryBank)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-purple-400 text-xs font-mono">{tx.trackingKey.length > 18 ? tx.trackingKey.slice(0, 18) + '...' : tx.trackingKey}</code>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-semibold ${tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedTransaction(tx); }} className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">{hasActiveFilters ? 'No se encontraron transacciones con los filtros aplicados' : 'No hay transacciones aún'}</p>
            {hasActiveFilters && <button onClick={clearFilters} className="mt-4 px-4 py-2 text-purple-400 hover:text-purple-300 text-sm">Limpiar filtros</button>}
          </div>
        )}

        {isLoading && <div className="text-center py-12"><RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto" /></div>}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
            <span className="text-white/40 text-sm">Mostrando {((pagination.page - 1) * pagination.itemsPerPage) + 1} - {Math.min(pagination.page * pagination.itemsPerPage, pagination.total)} de {pagination.total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page <= 1} className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg disabled:opacity-50 hover:bg-white/[0.05] transition-colors">
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page >= pagination.totalPages} className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg disabled:opacity-50 hover:bg-white/[0.05] transition-colors">
                <ChevronRight className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal - Card Style */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a1a] border border-white/[0.08] rounded-2xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Detalle de Transaccion</h2>
              <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Transaction header card */}
              <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className={`p-3 rounded-xl ${selectedTransaction.type === 'incoming' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {selectedTransaction.type === 'incoming' ? <ArrowDownLeft className="w-6 h-6 text-green-400" /> : <ArrowUpRight className="w-6 h-6 text-red-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/40">{selectedTransaction.type === 'incoming' ? 'Recibido de' : 'Enviado a'}</p>
                  <p className="text-white font-medium">{selectedTransaction.type === 'incoming' ? selectedTransaction.payerName : selectedTransaction.beneficiaryName || 'Sin nombre'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedTransaction.status)}`}>
                  {getStatusText(selectedTransaction.status)}
                </span>
              </div>

              {/* Amount */}
              <div className="text-center py-2">
                <p className="text-xs text-white/40 mb-1">Monto</p>
                <span className={`text-3xl font-bold font-mono ${selectedTransaction.type === 'incoming' ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedTransaction.type === 'incoming' ? '+' : '-'} {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>

              {/* Details cards */}
              <div className="space-y-3">
                {/* Tracking Key */}
                <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                  <p className="text-xs text-white/40 mb-1">Clave de Rastreo</p>
                  <div className="flex items-center justify-between">
                    <code className="text-white font-mono text-sm">{selectedTransaction.trackingKey}</code>
                    <button onClick={() => copyToClipboard(selectedTransaction.trackingKey, 'tracking')} className="p-1.5 hover:bg-white/[0.05] rounded transition-colors">
                      {copiedField === 'tracking' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                    </button>
                  </div>
                </div>

                {/* Date and Bank */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <p className="text-xs text-white/40 mb-1">Fecha y Hora</p>
                    <p className="text-white text-sm">{formatDate(selectedTransaction.createdAt)}</p>
                  </div>
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <p className="text-xs text-white/40 mb-1">{selectedTransaction.type === 'incoming' ? 'Banco Ordenante' : 'Banco Destino'}</p>
                    <p className="text-white text-sm">{getBankName(selectedTransaction.type === 'incoming' ? selectedTransaction.payerBank : selectedTransaction.beneficiaryBank)}</p>
                  </div>
                </div>

                {/* Concept */}
                {selectedTransaction.concept && (
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <p className="text-xs text-white/40 mb-1">Concepto</p>
                    <p className="text-white text-sm">{selectedTransaction.concept}</p>
                  </div>
                )}

                {/* CLABEs */}
                {selectedTransaction.type === 'incoming' ? (
                  <>
                    {selectedTransaction.beneficiaryAccount && (
                      <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        <p className="text-xs text-white/40 mb-1">CLABE Beneficiario</p>
                        <div className="flex items-center justify-between">
                          <code className="text-white font-mono text-sm">{formatClabe(selectedTransaction.beneficiaryAccount)}</code>
                          <button onClick={() => copyToClipboard(selectedTransaction.beneficiaryAccount!, 'beneficiary')} className="p-1.5 hover:bg-white/[0.05] rounded transition-colors">
                            {copiedField === 'beneficiary' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedTransaction.payerAccount && (
                      <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        <p className="text-xs text-white/40 mb-1">CLABE Ordenante</p>
                        <div className="flex items-center justify-between">
                          <code className="text-white font-mono text-sm">{formatClabe(selectedTransaction.payerAccount)}</code>
                          <button onClick={() => copyToClipboard(selectedTransaction.payerAccount!, 'payer')} className="p-1.5 hover:bg-white/[0.05] rounded transition-colors">
                            {copiedField === 'payer' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  selectedTransaction.beneficiaryAccount && (
                    <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                      <p className="text-xs text-white/40 mb-1">CLABE Destino</p>
                      <div className="flex items-center justify-between">
                        <code className="text-white font-mono text-sm">{formatClabe(selectedTransaction.beneficiaryAccount)}</code>
                        <button onClick={() => copyToClipboard(selectedTransaction.beneficiaryAccount!, 'beneficiary')} className="p-1.5 hover:bg-white/[0.05] rounded transition-colors">
                          {copiedField === 'beneficiary' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Reference */}
                {selectedTransaction.numericalReference && (
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <p className="text-xs text-white/40 mb-1">Referencia Numerica</p>
                    <p className="text-white font-mono text-sm">{selectedTransaction.numericalReference}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => copyToClipboard(`Clave: ${selectedTransaction.trackingKey}\nMonto: ${formatCurrency(selectedTransaction.amount)}\n${selectedTransaction.type === 'incoming' ? 'Ordenante' : 'Beneficiario'}: ${selectedTransaction.type === 'incoming' ? selectedTransaction.payerName : selectedTransaction.beneficiaryName}`, 'all')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white/[0.05] hover:bg-white/[0.08] text-white/80 rounded-lg transition-colors text-sm"
                >
                  {copiedField === 'all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar Datos
                </button>
                <button
                  onClick={() => generateReceiptPDF(selectedTransaction)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
              </div>

              {selectedTransaction.status === 'scattered' && selectedTransaction.type === 'outgoing' && (
                <button
                  onClick={() => handleGetCep(selectedTransaction)}
                  disabled={loadingCep}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/[0.03] hover:bg-white/[0.05] text-white/60 rounded-lg transition-colors text-sm border border-white/[0.08]"
                >
                  {loadingCep ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {loadingCep ? 'Obteniendo...' : 'Obtener CEP de Banxico'}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
