'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Building2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth, useRequirePermission } from '@/context/AuthContext';
import { ClabeAccount, Company } from '@/types';

interface ClabeFormData {
  id: string;
  companyId: string;
  clabe: string;
  alias: string;
  description: string;
  isActive: boolean;
}

const defaultFormData: ClabeFormData = {
  id: '',
  companyId: '',
  clabe: '',
  alias: '',
  description: '',
  isActive: true,
};

export default function ClabeAccountsPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { isLoading, hasAccess } = useRequirePermission('clabe.view');

  const [clabeAccounts, setClabeAccounts] = useState<ClabeAccount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingClabes, setLoadingClabes] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedClabe, setSelectedClabe] = useState<ClabeAccount | null>(null);
  const [formData, setFormData] = useState<ClabeFormData>(defaultFormData);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch CLABE accounts from API
  const fetchClabeAccounts = async () => {
    try {
      setLoadingClabes(true);
      let url = '/api/clabe-accounts';

      // If user is company_admin, filter by their company
      if (currentUser?.role === 'company_admin' && currentUser.companyId) {
        url += `?companyId=${currentUser.companyId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setClabeAccounts(data);
      }
    } catch (error) {
      console.error('Error fetching CLABE accounts:', error);
    } finally {
      setLoadingClabes(false);
    }
  };

  // Fetch companies for dropdown
  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  // Load data
  useEffect(() => {
    if (hasAccess) {
      fetchClabeAccounts();
      // Only super_admin can see all companies
      if (currentUser?.role === 'super_admin') {
        fetchCompanies();
      }
    }
  }, [hasAccess, currentUser]);

  // Filter CLABE accounts
  const filteredClabeAccounts = clabeAccounts.filter((ca) => {
    const matchesSearch =
      ca.clabe.includes(searchQuery) ||
      ca.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ca.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany = filterCompany === 'all' || ca.companyId === filterCompany;

    return matchesSearch && matchesCompany;
  });

  // Get company name by ID
  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    return company?.name || 'Empresa no encontrada';
  };

  // Copy CLABE to clipboard
  const handleCopyClabe = async (clabe: string, id: string) => {
    try {
      await navigator.clipboard.writeText(clabe);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  // Format CLABE for display (groups of 4)
  const formatClabe = (clabe: string) => {
    return clabe.replace(/(.{4})/g, '$1 ').trim();
  };

  // Open modal for creating new CLABE
  const handleCreate = () => {
    setSelectedClabe(null);
    setFormData({
      ...defaultFormData,
      id: `clabe_${Date.now()}`,
      // Pre-select company if user is company_admin
      companyId: currentUser?.role === 'company_admin' && currentUser.companyId
        ? currentUser.companyId
        : '',
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open modal for editing CLABE
  const handleEdit = (clabeAccount: ClabeAccount) => {
    setSelectedClabe(clabeAccount);
    setFormData({
      id: clabeAccount.id,
      companyId: clabeAccount.companyId,
      clabe: clabeAccount.clabe,
      alias: clabeAccount.alias,
      description: clabeAccount.description || '',
      isActive: clabeAccount.isActive,
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (clabeAccount: ClabeAccount) => {
    setSelectedClabe(clabeAccount);
    setIsDeleteModalOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (selectedClabe) {
      try {
        setSaving(true);
        const response = await fetch(`/api/clabe-accounts/${selectedClabe.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          await fetchClabeAccounts();
          setIsDeleteModalOpen(false);
          setSelectedClabe(null);
        } else {
          const data = await response.json();
          setError(data.error || 'Error al eliminar cuenta CLABE');
        }
      } catch (error) {
        console.error('Delete error:', error);
        setError('Error al eliminar cuenta CLABE');
      } finally {
        setSaving(false);
      }
    }
  };

  // Save CLABE (create or update)
  const handleSave = async () => {
    // Validation
    if (!formData.companyId || !formData.clabe || !formData.alias) {
      setError('Empresa, CLABE y alias son requeridos');
      return;
    }

    // Validate CLABE format (18 digits)
    if (!/^[0-9]{18}$/.test(formData.clabe)) {
      setError('La CLABE debe tener exactamente 18 dígitos');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const clabeData = {
        companyId: formData.companyId,
        clabe: formData.clabe,
        alias: formData.alias,
        description: formData.description || undefined,
        isActive: formData.isActive,
      };

      let response;
      if (selectedClabe) {
        // Update existing CLABE (cannot change clabe number or company)
        response = await fetch(`/api/clabe-accounts/${selectedClabe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alias: clabeData.alias,
            description: clabeData.description,
            isActive: clabeData.isActive,
          }),
        });
      } else {
        // Create new CLABE
        response = await fetch('/api/clabe-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clabeData),
        });
      }

      if (response.ok) {
        await fetchClabeAccounts();
        setIsModalOpen(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al guardar cuenta CLABE');
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Error al guardar cuenta CLABE');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-400" />
            Cuentas CLABE
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Administra las cuentas CLABE (centros de costos)
          </p>
        </div>

        {hasPermission('clabe.create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Cuenta CLABE
          </motion.button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar por CLABE, alias o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {currentUser?.role === 'super_admin' && companies.length > 0 && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
          >
            <option value="all" className="bg-[#0a0a1a]">Todas las empresas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id} className="bg-[#0a0a1a]">
                {company.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* CLABE accounts table */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Cuenta CLABE
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Alias
                </th>
                {currentUser?.role === 'super_admin' && (
                  <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                    Empresa
                  </th>
                )}
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Estado
                </th>
                <th className="text-right text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredClabeAccounts.map((clabeAccount, index) => (
                <motion.tr
                  key={clabeAccount.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-purple-400 font-mono text-sm">
                        {formatClabe(clabeAccount.clabe)}
                      </code>
                      <button
                        onClick={() => handleCopyClabe(clabeAccount.clabe, clabeAccount.id)}
                        className="p-1.5 text-white/30 hover:text-white hover:bg-white/[0.05] rounded transition-colors"
                        title="Copiar CLABE"
                      >
                        {copiedId === clabeAccount.id ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{clabeAccount.alias}</p>
                      {clabeAccount.description && (
                        <p className="text-white/40 text-sm">{clabeAccount.description}</p>
                      )}
                    </div>
                  </td>
                  {currentUser?.role === 'super_admin' && (
                    <td className="px-6 py-4">
                      <span className="text-white/60 text-sm flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-white/40" />
                        {getCompanyName(clabeAccount.companyId)}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        clabeAccount.isActive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          clabeAccount.isActive ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      />
                      {clabeAccount.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {hasPermission('clabe.update') && (
                        <button
                          onClick={() => handleEdit(clabeAccount)}
                          className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('clabe.delete') && (
                        <button
                          onClick={() => handleDeleteClick(clabeAccount)}
                          className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredClabeAccounts.length === 0 && !loadingClabes && (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No se encontraron cuentas CLABE</p>
          </div>
        )}

        {loadingClabes && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a1a] border border-white/[0.08] rounded-2xl shadow-2xl"
            >
              {/* Modal header */}
              <div className="sticky top-0 z-10 bg-[#0a0a1a] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  {selectedClabe ? 'Editar Cuenta CLABE' : 'Nueva Cuenta CLABE'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-4">
                {/* Error message */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Company selector - only for super_admin creating new */}
                {currentUser?.role === 'super_admin' && !selectedClabe && (
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Empresa
                    </label>
                    <select
                      value={formData.companyId}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, companyId: e.target.value }))
                      }
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    >
                      <option value="" className="bg-[#0a0a1a]">Seleccionar empresa...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id} className="bg-[#0a0a1a]">
                          {company.name} - {company.rfc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* CLABE number - only for new */}
                {!selectedClabe && (
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Cuenta CLABE (18 dígitos)
                    </label>
                    <input
                      type="text"
                      value={formData.clabe}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 18);
                        setFormData((prev) => ({ ...prev, clabe: value }));
                      }}
                      placeholder="012345678901234567"
                      maxLength={18}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
                    />
                    <p className="text-white/30 text-xs">
                      {formData.clabe.length}/18 dígitos
                    </p>
                  </div>
                )}

                {/* Display CLABE for editing */}
                {selectedClabe && (
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Cuenta CLABE
                    </label>
                    <div className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg py-2.5 px-4">
                      <code className="text-purple-400 font-mono text-sm">
                        {formatClabe(selectedClabe.clabe)}
                      </code>
                    </div>
                    <p className="text-white/30 text-xs">
                      La CLABE no puede ser modificada
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Alias (nombre descriptivo)
                  </label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, alias: e.target.value }))
                    }
                    placeholder="Ej: Sucursal Norte, Centro de Costos 1"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Descripción adicional de la cuenta..."
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                  />
                </div>

                {/* Status toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      formData.isActive ? 'bg-green-500' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        formData.isActive ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                  <span className="text-white/60 text-sm">
                    Cuenta {formData.isActive ? 'activa' : 'inactiva'}
                  </span>
                </div>
              </div>

              {/* Modal footer */}
              <div className="sticky bottom-0 bg-[#0a0a1a] border-t border-white/[0.06] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
                >
                  Cancelar
                </button>
                <motion.button
                  whileHover={{ scale: saving ? 1 : 1.02 }}
                  whileTap={{ scale: saving ? 1 : 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {selectedClabe ? 'Guardar cambios' : 'Crear cuenta'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedClabe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsDeleteModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a1a] border border-white/[0.08] rounded-2xl shadow-2xl p-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Eliminar cuenta CLABE
                </h3>
                <p className="text-white/60 text-sm mb-2">
                  ¿Estás seguro de que deseas eliminar la cuenta CLABE{' '}
                  <span className="text-white font-medium">{selectedClabe.alias}</span>?
                </p>
                <p className="text-white/40 text-xs mb-6 font-mono">
                  {formatClabe(selectedClabe.clabe)}
                </p>
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setError('');
                    }}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteConfirm}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Eliminar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
