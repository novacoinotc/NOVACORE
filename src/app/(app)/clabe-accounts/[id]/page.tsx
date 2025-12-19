'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Search,
  RefreshCw,
  Loader2,
  Eye,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  AlertCircle,
  Download,
} from 'lucide-react';
import { formatCurrency, formatDate, getStatusText, formatClabe } from '@/lib/utils';
import { getBankFromSpeiCode } from '@/lib/banks';
import { NovacorpLogo } from '@/components/ui/NovacorpLogo';
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

interface ClabeAccount {
  id: string;
  companyId: string;
  clabe: string;
  alias: string;
  description?: string;
  isActive: boolean;
  isMain: boolean;
}

interface Stats {
  totalCount: number;
  totalIncoming: number;
  totalOutgoing: number;
  inTransit: number;
  // Calculated balance for this specific CLABE (incoming settled - outgoing sent/settled)
  settledIncoming: number;
  settledOutgoing: number;
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

export default function ClabeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clabeId = params.id as string;

  // State
  const [clabeAccount, setClabeAccount] = useState<ClabeAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCount: 0,
    totalIncoming: 0,
    totalOutgoing: 0,
    inTransit: 0,
    settledIncoming: 0,
    settledOutgoing: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, itemsPerPage: 20, total: 0, totalPages: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedClabe, setCopiedClabe] = useState(false);

  // Calculated balance for this CLABE (settled incoming - settled/sent outgoing)
  const calculatedBalance = stats.settledIncoming - stats.settledOutgoing;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch CLABE account details
  const fetchClabeAccount = async () => {
    try {
      const response = await fetch(`/api/clabe-accounts/${clabeId}`);
      if (!response.ok) throw new Error('Cuenta no encontrada');
      const data = await response.json();
      setClabeAccount(data);
      return data;
    } catch (err) {
      setError('No se pudo cargar la cuenta CLABE');
      return null;
    }
  };

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!clabeId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        clabeAccountId: clabeId,
        page: pagination.page.toString(),
        itemsPerPage: pagination.itemsPerPage.toString(),
      });

      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error('Error al cargar transacciones');

      const data = await response.json();
      setTransactions(data.transactions || []);
      setStats(data.stats || { totalCount: 0, totalIncoming: 0, totalOutgoing: 0, inTransit: 0 });
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clabeId, pagination.page, pagination.itemsPerPage, statusFilter, typeFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchClabeAccount();
  }, [clabeId]);

  // Fetch transactions when filters change
  useEffect(() => {
    if (clabeAccount) {
      fetchTransactions();
    }
  }, [clabeAccount, fetchTransactions]);

  // Copy CLABE
  const handleCopyClabe = () => {
    if (clabeAccount?.clabe) {
      navigator.clipboard.writeText(clabeAccount.clabe);
      setCopiedClabe(true);
      setTimeout(() => setCopiedClabe(false), 2000);
    }
  };

  // Refresh balance (recalculate from transactions)
  const handleRefreshBalance = () => {
    fetchTransactions();
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

  if (error && !clabeAccount) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
        <p className="text-white/60 mb-4">{error}</p>
        <button
          onClick={() => router.push('/clabe-accounts')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
        >
          Volver a Cuentas CLABE
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/clabe-accounts')}
          className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {clabeAccount?.alias || 'Cargando...'}
            </h1>
            {clabeAccount?.isMain && (
              <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full border border-purple-500/30">
                Principal
              </span>
            )}
            {clabeAccount && (
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                clabeAccount.isActive
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {clabeAccount.isActive ? 'Activo' : 'Inactivo'}
              </span>
            )}
          </div>
          {clabeAccount && (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-purple-400 font-mono">
                {formatClabe(clabeAccount.clabe)}
              </code>
              <button
                onClick={handleCopyClabe}
                className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.05] rounded transition-colors"
                title="Copiar CLABE"
              >
                {copiedClabe ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Disponible - Calculated from transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60 text-sm">Saldo Disponible</span>
            <button
              onClick={handleRefreshBalance}
              disabled={isLoading}
              className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.05] rounded transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <DollarSign className="w-5 h-5 text-purple-400" />
            <span className={`text-2xl font-bold ${calculatedBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              {isLoading ? '...' : formatCurrency(calculatedBalance)}
            </span>
          </div>
          {stats.inTransit > 0 && (
            <p className="text-xs text-white/40 mt-2">
              En tránsito: {formatCurrency(stats.inTransit)}
            </p>
          )}
        </motion.div>

        {/* Total Entrante */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-white/60 text-sm">Total Entrante</span>
          </div>
          <div className="flex items-baseline gap-2">
            <ArrowDownLeft className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {formatCurrency(stats.totalIncoming)}
            </span>
          </div>
        </motion.div>

        {/* Total Saliente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-white/60 text-sm">Total Saliente</span>
          </div>
          <div className="flex items-baseline gap-2">
            <ArrowUpRight className="w-5 h-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400">
              {formatCurrency(stats.totalOutgoing)}
            </span>
          </div>
        </motion.div>

        {/* En Tránsito */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-white/60 text-sm">En Tránsito</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-yellow-400">
              {formatCurrency(stats.inTransit)}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-2">
            {stats.totalCount} transacciones
          </p>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                {typeOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#0a0a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => fetchTransactions()}
                className="p-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-white/60 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Tipo
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Contraparte
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Concepto
                </th>
                <th className="text-right text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Monto
                </th>
                <th className="text-center text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Estado
                </th>
                <th className="text-right text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">
                  Fecha
                </th>
                <th className="text-center text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-3">

                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.type === 'incoming' ? (
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <ArrowDownLeft className="w-4 h-4 text-green-400" />
                        </div>
                      ) : (
                        <div className="p-2 bg-red-500/10 rounded-lg">
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                        </div>
                      )}
                      <span className="text-white/60 text-sm">
                        {tx.type === 'incoming' ? 'Entrada' : 'Salida'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-[200px]">
                        {tx.type === 'incoming' ? tx.payerName : tx.beneficiaryName || 'Sin nombre'}
                      </p>
                      <p className="text-white/40 text-xs">
                        {tx.type === 'incoming'
                          ? getBankFromSpeiCode(tx.payerBank || '')?.shortName || tx.payerBank
                          : getBankFromSpeiCode(tx.beneficiaryBank || '')?.shortName || tx.beneficiaryBank}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-white/60 text-sm truncate max-w-[200px]">
                      {tx.concept || 'Sin concepto'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-semibold ${
                      tx.type === 'incoming' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {tx.type === 'incoming' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(tx.status)}`}>
                      {getStatusText(tx.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-white/40 text-sm">
                      {formatDate(tx.createdAt)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setSelectedTransaction(tx)}
                      className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {transactions.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No hay transacciones para esta cuenta</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
            <span className="text-white/40 text-sm">
              Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg disabled:opacity-50 hover:bg-white/[0.05] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 bg-white/[0.03] border border-white/[0.08] rounded-lg disabled:opacity-50 hover:bg-white/[0.05] transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTransaction(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a1a] border border-white/[0.08] rounded-2xl shadow-2xl"
          >
            {/* Logo Header */}
            <div className="flex flex-col items-center pt-4 pb-3 border-b border-white/[0.06]">
              <NovacorpLogo size="md" />
              <p className="text-xs text-white/40 mt-2">Comprobante de Operacion</p>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="absolute top-3 right-3 p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Amount */}
              <div className="text-center py-4">
                <span className={`text-3xl font-bold ${
                  selectedTransaction.type === 'incoming' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {selectedTransaction.type === 'incoming' ? '+' : '-'}
                  {formatCurrency(selectedTransaction.amount)}
                </span>
                <p className="text-white/40 mt-1">
                  {selectedTransaction.type === 'incoming' ? 'Depósito recibido' : 'Transferencia enviada'}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-white/40">Estado</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedTransaction.status)}`}>
                    {getStatusText(selectedTransaction.status)}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-white/40">Clave de Rastreo</span>
                  <code className="text-purple-400 font-mono text-xs">{selectedTransaction.trackingKey}</code>
                </div>

                {selectedTransaction.concept && (
                  <div className="flex justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-white/40">Concepto</span>
                    <span className="text-white text-right max-w-[200px]">{selectedTransaction.concept}</span>
                  </div>
                )}

                {selectedTransaction.type === 'incoming' ? (
                  <>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Ordenante</span>
                      <span className="text-white">{selectedTransaction.payerName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Cuenta Origen</span>
                      <code className="text-white/60 font-mono text-xs">{selectedTransaction.payerAccount || 'N/A'}</code>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Banco Origen</span>
                      <span className="text-white/60">
                        {getBankFromSpeiCode(selectedTransaction.payerBank || '')?.name || selectedTransaction.payerBank || 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Beneficiario</span>
                      <span className="text-white">{selectedTransaction.beneficiaryName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Cuenta Destino</span>
                      <code className="text-white/60 font-mono text-xs">{selectedTransaction.beneficiaryAccount || 'N/A'}</code>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-white/40">Banco Destino</span>
                      <span className="text-white/60">
                        {getBankFromSpeiCode(selectedTransaction.beneficiaryBank || '')?.name || selectedTransaction.beneficiaryBank || 'N/A'}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between py-2 border-b border-white/[0.06]">
                  <span className="text-white/40">Fecha</span>
                  <span className="text-white/60">{formatDate(selectedTransaction.createdAt)}</span>
                </div>

                {selectedTransaction.settledAt && (
                  <div className="flex justify-between py-2 border-b border-white/[0.06]">
                    <span className="text-white/40">Liquidada</span>
                    <span className="text-white/60">{formatDate(selectedTransaction.settledAt)}</span>
                  </div>
                )}

                {selectedTransaction.errorDetail && (
                  <div className="py-2 border-b border-white/[0.06]">
                    <span className="text-white/40 block mb-1">Error</span>
                    <span className="text-red-400 text-xs">{selectedTransaction.errorDetail}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Clave: ${selectedTransaction.trackingKey}\nMonto: ${formatCurrency(selectedTransaction.amount)}\n${selectedTransaction.type === 'incoming' ? 'Ordenante' : 'Beneficiario'}: ${selectedTransaction.type === 'incoming' ? selectedTransaction.payerName : selectedTransaction.beneficiaryName}`
                    );
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white/[0.05] hover:bg-white/[0.08] text-white/80 rounded-lg transition-colors text-sm"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Datos
                </button>
                <button
                  onClick={() => generateReceiptPDF(selectedTransaction)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Descargar Comprobante
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
