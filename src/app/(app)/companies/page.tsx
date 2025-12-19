'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Loader2,
  Users,
  CreditCard,
  Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useRequirePermission, getAuthHeaders } from '@/context/AuthContext';
import { Company } from '@/types';

interface CompanyFormData {
  id: string;
  name: string;
  businessName: string;
  rfc: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
}

const defaultFormData: CompanyFormData = {
  id: '',
  name: '',
  businessName: '',
  rfc: '',
  email: '',
  phone: '',
  address: '',
  isActive: true,
};

export default function CompaniesPage() {
  const router = useRouter();
  const { user: currentUser, hasPermission } = useAuth();
  const { isLoading, hasAccess } = useRequirePermission('companies.view');
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>(defaultFormData);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch companies from API
  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const response = await fetch('/api/companies', { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Load companies
  useEffect(() => {
    if (hasAccess) {
      fetchCompanies();
    }
  }, [hasAccess]);

  // Filter companies by search
  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rfc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open modal for creating new company
  const handleCreate = () => {
    setSelectedCompany(null);
    setFormData({
      ...defaultFormData,
      id: `company_${Date.now()}`,
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open modal for editing company
  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      id: company.id,
      name: company.name,
      businessName: company.businessName,
      rfc: company.rfc,
      email: company.email,
      phone: company.phone || '',
      address: company.address || '',
      isActive: company.isActive,
    });
    setError('');
    setIsModalOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteModalOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (selectedCompany) {
      try {
        setSaving(true);
        const response = await fetch(`/api/companies/${selectedCompany.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          await fetchCompanies();
          setIsDeleteModalOpen(false);
          setSelectedCompany(null);
        } else {
          const data = await response.json();
          setError(data.error || 'Error al eliminar empresa');
        }
      } catch (error) {
        console.error('Delete error:', error);
        setError('Error al eliminar empresa');
      } finally {
        setSaving(false);
      }
    }
  };

  // Save company (create or update)
  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.businessName || !formData.rfc || !formData.email) {
      setError('Nombre, razón social, RFC y email son requeridos');
      return;
    }

    // Validate RFC format
    const rfcRegex = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(formData.rfc)) {
      setError('Formato de RFC inválido');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const companyData = {
        name: formData.name,
        businessName: formData.businessName,
        rfc: formData.rfc.toUpperCase(),
        email: formData.email,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        isActive: formData.isActive,
      };

      let response;
      if (selectedCompany) {
        // Update existing company
        response = await fetch(`/api/companies/${selectedCompany.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(companyData),
        });
      } else {
        // Create new company
        response = await fetch('/api/companies', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(companyData),
        });
      }

      if (response.ok) {
        await fetchCompanies();
        setIsModalOpen(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al guardar empresa');
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Error al guardar empresa');
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
            <Building2 className="w-6 h-6 text-purple-400" />
            Gestión de Empresas
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Administra las empresas registradas en el sistema
          </p>
        </div>

        {hasPermission('companies.create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva Empresa
          </motion.button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar por nombre, razón social o RFC..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>

      {/* Companies grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCompanies.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    company.isActive
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      company.isActive ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  />
                  {company.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            <h3 className="text-white font-semibold mb-1">{company.name}</h3>
            <p className="text-white/40 text-sm mb-2">{company.businessName}</p>

            <div className="space-y-1.5 mb-4">
              <p className="text-white/60 text-xs">
                <span className="text-white/40">RFC:</span> {company.rfc}
              </p>
              <p className="text-white/60 text-xs">
                <span className="text-white/40">Email:</span> {company.email}
              </p>
              {company.phone && (
                <p className="text-white/60 text-xs">
                  <span className="text-white/40">Tel:</span> {company.phone}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 text-white/40 text-xs">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Usuarios
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  CLABEs
                </span>
              </div>
              <div className="flex items-center gap-1">
                {isSuperAdmin && (
                  <button
                    onClick={() => router.push(`/companies/${company.id}`)}
                    className="p-2 text-white/40 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {hasPermission('companies.update') && (
                  <button
                    onClick={() => handleEdit(company)}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {hasPermission('companies.delete') && (
                  <button
                    onClick={() => handleDeleteClick(company)}
                    className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredCompanies.length === 0 && !loadingCompanies && (
        <div className="text-center py-12 backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <Building2 className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No se encontraron empresas</p>
        </div>
      )}

      {loadingCompanies && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
        </div>
      )}

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
                  <Building2 className="w-5 h-5 text-purple-400" />
                  {selectedCompany ? 'Editar Empresa' : 'Nueva Empresa'}
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

                {/* Form fields */}
                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Nombre de la empresa"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessName: e.target.value }))
                    }
                    placeholder="Razón social completa"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      RFC
                    </label>
                    <input
                      type="text"
                      value={formData.rfc}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, rfc: e.target.value.toUpperCase() }))
                      }
                      placeholder="RFC123456ABC"
                      maxLength={13}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="5555555555"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="contacto@empresa.com"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-white/40 text-xs uppercase tracking-wider">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Dirección fiscal"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
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
                    Empresa {formData.isActive ? 'activa' : 'inactiva'}
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
                  {selectedCompany ? 'Guardar cambios' : 'Crear empresa'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedCompany && (
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
                  Eliminar empresa
                </h3>
                <p className="text-white/60 text-sm mb-6">
                  ¿Estás seguro de que deseas eliminar{' '}
                  <span className="text-white font-medium">{selectedCompany.name}</span>?
                  Esta acción eliminará también todas las cuentas CLABE asociadas.
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
