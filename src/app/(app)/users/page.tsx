'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  X,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  UserCog,
  ChevronDown,
  ChevronUp,
  Loader2,
  Building2,
  Hash,
} from 'lucide-react';
import { useAuth, useRequirePermission } from '@/context/AuthContext';
import {
  User,
  Permission,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  UserRole,
} from '@/types';

// Permission categories for organized display
const PERMISSION_CATEGORIES = {
  'Dashboard': ['dashboard.view'],
  'Saldos': ['balance.view'],
  'Transferencias': ['orders.view', 'orders.create', 'orders.cancel', 'orders.cep', 'orders.notify'],
  'Cuentas Guardadas': ['savedAccounts.view', 'savedAccounts.create', 'savedAccounts.update', 'savedAccounts.delete'],
  'Historial': ['history.view'],
  'Catálogos': ['banks.view', 'catalogs.view'],
  'Configuración': ['settings.view', 'settings.update'],
  'Usuarios': ['users.view', 'users.create', 'users.update', 'users.delete'],
} as const;

interface ClabeAccount {
  id: string;
  clabe: string;
  alias: string;
  description?: string;
  isActive: boolean;
}

interface UserFormData {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  clabeAccountIds: string[];
}

const defaultFormData: UserFormData = {
  id: '',
  email: '',
  password: '',
  name: '',
  role: 'user',
  permissions: [...DEFAULT_ROLE_PERMISSIONS.user],
  isActive: true,
  clabeAccountIds: [],
};

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const { isLoading, hasAccess } = useRequirePermission('users.view');

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(defaultFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(Object.keys(PERMISSION_CATEGORIES));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [clabeAccounts, setClabeAccounts] = useState<ClabeAccount[]>([]);
  const [loadingClabeAccounts, setLoadingClabeAccounts] = useState(false);

  // Fetch users from API
  const fetchUsers = async () => {
    if (!currentUser) return;

    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users', {
        headers: {
          'x-user-id': currentUser.id,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load users
  useEffect(() => {
    if (hasAccess && currentUser) {
      fetchUsers();
    }
  }, [hasAccess, currentUser]);

  // Fetch CLABE accounts for the company
  const fetchClabeAccounts = async () => {
    if (!currentUser) return;

    try {
      setLoadingClabeAccounts(true);
      // For super_admin, fetch all; for company_admin, fetch for their company
      let url = '/api/clabe-accounts';
      if (currentUser.role === 'company_admin' && currentUser.companyId) {
        url = `/api/clabe-accounts?companyId=${currentUser.companyId}`;
      }

      const response = await fetch(url, {
        headers: {
          'x-user-id': currentUser.id,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClabeAccounts(data.filter((acc: ClabeAccount) => acc.isActive));
      }
    } catch (error) {
      console.error('Error fetching CLABE accounts:', error);
    } finally {
      setLoadingClabeAccounts(false);
    }
  };

  // Filter users by search
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open modal for creating new user
  const handleCreate = () => {
    setSelectedUser(null);
    setFormData({
      ...defaultFormData,
      id: `user_${Date.now()}`,
    });
    setError('');
    fetchClabeAccounts(); // Load CLABE accounts
    setIsModalOpen(true);
  };

  // Open modal for editing user
  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      id: user.id,
      email: user.email,
      password: '', // Don't show existing password
      name: user.name,
      role: user.role,
      permissions: [...user.permissions],
      isActive: user.isActive,
      clabeAccountIds: user.clabeAccountIds || [],
    });
    setError('');
    fetchClabeAccounts(); // Load CLABE accounts
    setIsModalOpen(true);
  };

  // Open delete confirmation
  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setError(''); // Clear any previous errors
    setIsDeleteModalOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (selectedUser && currentUser) {
      try {
        setSaving(true);
        const response = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': currentUser.id,
          },
        });

        if (response.ok) {
          await fetchUsers();
          setIsDeleteModalOpen(false);
          setSelectedUser(null);
        } else {
          const data = await response.json();
          setError(data.error || 'Error al eliminar usuario');
        }
      } catch (error) {
        console.error('Delete error:', error);
        setError('Error al eliminar usuario');
      } finally {
        setSaving(false);
      }
    }
  };

  // Save user (create or update)
  const handleSave = async () => {
    if (!currentUser) return;

    // Validation
    if (!formData.email || !formData.name) {
      setError('Email y nombre son requeridos');
      return;
    }

    if (!selectedUser && !formData.password) {
      setError('Contraseña es requerida para nuevos usuarios');
      return;
    }

    // company_admin can only create users for their own company
    // and cannot create super_admin
    if (currentUser.role === 'company_admin') {
      if (formData.role === 'super_admin') {
        setError('No tienes permiso para crear super administradores');
        return;
      }
    }

    try {
      setSaving(true);
      setError('');

      const userData: any = {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        permissions: formData.role === 'super_admin'
          ? Object.keys(ALL_PERMISSIONS) as Permission[]
          : formData.permissions,
        isActive: formData.isActive,
        clabeAccountIds: formData.clabeAccountIds,
        ...(formData.password && { password: formData.password }),
      };

      // For company_admin, automatically assign their company to new users
      if (currentUser.role === 'company_admin' && !selectedUser) {
        userData.companyId = currentUser.companyId;
      }

      // For super_admin creating company_admin or user, they need to select a company
      // This will be handled by the API validation

      let response;
      if (selectedUser) {
        // Update existing user
        response = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify(userData),
        });
      } else {
        // Create new user
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': currentUser.id,
          },
          body: JSON.stringify(userData),
        });
      }

      if (response.ok) {
        await fetchUsers();
        setIsModalOpen(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al guardar usuario');
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  // Toggle permission
  const togglePermission = (permission: Permission) => {
    if (formData.role === 'super_admin') return; // Super admin has all permissions

    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  // Toggle all permissions in a category
  const toggleCategory = (category: string) => {
    if (formData.role === 'super_admin') return;

    const categoryPermissions = PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES] as readonly Permission[];
    const allSelected = categoryPermissions.every((p) => formData.permissions.includes(p));

    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !categoryPermissions.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...categoryPermissions])),
      }));
    }
  };

  // Toggle category expansion
  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // Handle role change
  const handleRoleChange = (role: UserRole) => {
    setFormData((prev) => ({
      ...prev,
      role,
      permissions: role === 'super_admin'
        ? Object.keys(ALL_PERMISSIONS) as Permission[]
        : DEFAULT_ROLE_PERMISSIONS[role],
    }));
  };

  // Toggle CLABE account access
  const toggleClabeAccess = (clabeAccountId: string) => {
    setFormData((prev) => ({
      ...prev,
      clabeAccountIds: prev.clabeAccountIds.includes(clabeAccountId)
        ? prev.clabeAccountIds.filter((id) => id !== clabeAccountId)
        : [...prev.clabeAccountIds, clabeAccountId],
    }));
  };

  // Toggle all CLABE accounts
  const toggleAllClabeAccounts = () => {
    if (formData.clabeAccountIds.length === clabeAccounts.length) {
      // Deselect all
      setFormData((prev) => ({ ...prev, clabeAccountIds: [] }));
    } else {
      // Select all
      setFormData((prev) => ({
        ...prev,
        clabeAccountIds: clabeAccounts.map((acc) => acc.id),
      }));
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
            <Users className="w-6 h-6 text-purple-400" />
            Gestión de Usuarios
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Administra usuarios y sus permisos
          </p>
        </div>

        {hasPermission('users.create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </motion.button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>

      {/* Users table */}
      <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Usuario
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Rol
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Estado
                </th>
                <th className="text-left text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Permisos
                </th>
                <th className="text-right text-white/40 text-xs font-medium uppercase tracking-wider px-6 py-4">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-white/40 text-sm">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.role === 'super_admin'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : user.role === 'company_admin'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {user.role === 'super_admin' ? (
                        <ShieldCheck className="w-3 h-3" />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'company_admin' ? 'Admin Empresa' : 'Usuario'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.isActive ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      />
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white/60 text-sm">
                      {user.role === 'super_admin'
                        ? 'Todos'
                        : `${user.permissions.length} permisos`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {hasPermission('users.update') && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('users.delete') && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteClick(user)}
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

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No se encontraron usuarios</p>
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
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0a1a] border border-white/[0.08] rounded-2xl shadow-2xl"
            >
              {/* Modal header */}
              <div className="sticky top-0 z-10 bg-[#0a0a1a] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-purple-400" />
                  {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6">
                {/* Error message */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Basic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Nombre completo"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
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
                      placeholder="usuario@ejemplo.com"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Contraseña {selectedUser && '(dejar vacío para mantener)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, password: e.target.value }))
                        }
                        placeholder="••••••••"
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 pl-4 pr-10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-white/40 text-xs uppercase tracking-wider">
                      Rol
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg py-2.5 px-4 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                    >
                      <option value="user" className="bg-[#0a0a1a]">Usuario</option>
                      <option value="company_admin" className="bg-[#0a0a1a]">Admin Empresa</option>
                      {currentUser?.role === 'super_admin' && (
                        <option value="super_admin" className="bg-[#0a0a1a]">Super Admin</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Status toggle */}
                <div className="flex items-center gap-3">
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
                    Usuario {formData.isActive ? 'activo' : 'inactivo'}
                  </span>
                </div>

                {/* Permissions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-400" />
                      Permisos
                    </h3>
                    {formData.role === 'super_admin' && (
                      <span className="text-purple-400 text-xs bg-purple-500/10 px-2 py-1 rounded">
                        Admin tiene todos los permisos
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {Object.entries(PERMISSION_CATEGORIES).map(([category, permissions]) => {
                      const categoryPermissions = permissions as readonly Permission[];
                      const selectedCount = categoryPermissions.filter((p) =>
                        formData.role === 'super_admin' || formData.permissions.includes(p)
                      ).length;
                      const isExpanded = expandedCategories.includes(category);

                      return (
                        <div
                          key={category}
                          className="border border-white/[0.06] rounded-lg overflow-hidden"
                        >
                          {/* Category header */}
                          <div
                            className={`flex items-center justify-between px-4 py-3 ${
                              formData.role === 'super_admin'
                                ? 'bg-purple-500/5'
                                : 'bg-white/[0.02] hover:bg-white/[0.04]'
                            } cursor-pointer transition-colors`}
                            onClick={() => toggleCategoryExpand(category)}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCategory(category);
                                }}
                                disabled={formData.role === 'super_admin'}
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                  formData.role === 'super_admin' || selectedCount === categoryPermissions.length
                                    ? 'bg-purple-500 border-purple-500'
                                    : selectedCount > 0
                                    ? 'bg-purple-500/50 border-purple-500/50'
                                    : 'border-white/20 hover:border-white/40'
                                }`}
                              >
                                {(formData.role === 'super_admin' || selectedCount === categoryPermissions.length) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                                {formData.role !== 'super_admin' && selectedCount > 0 && selectedCount < categoryPermissions.length && (
                                  <div className="w-2 h-0.5 bg-white rounded" />
                                )}
                              </button>
                              <span className="text-white font-medium text-sm">
                                {category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/40 text-xs">
                                {selectedCount}/{categoryPermissions.length}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-white/40" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                          </div>

                          {/* Category permissions */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 py-3 space-y-2 bg-black/20">
                                  {categoryPermissions.map((permission) => {
                                    const isSelected =
                                      formData.role === 'super_admin' ||
                                      formData.permissions.includes(permission);

                                    return (
                                      <label
                                        key={permission}
                                        className={`flex items-center gap-3 cursor-pointer ${
                                          formData.role === 'super_admin'
                                            ? 'opacity-60 cursor-default'
                                            : ''
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => togglePermission(permission)}
                                          disabled={formData.role === 'super_admin'}
                                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                            isSelected
                                              ? 'bg-purple-500 border-purple-500'
                                              : 'border-white/20 hover:border-white/40'
                                          }`}
                                        >
                                          {isSelected && (
                                            <Check className="w-2.5 h-2.5 text-white" />
                                          )}
                                        </button>
                                        <span className="text-white/70 text-sm">
                                          {ALL_PERMISSIONS[permission]}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CLABE Account Access - Only for non-super_admin users */}
                {formData.role !== 'super_admin' && clabeAccounts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-medium flex items-center gap-2">
                        <Hash className="w-4 h-4 text-purple-400" />
                        Acceso a Cuentas CLABE
                      </h3>
                      <span className="text-white/40 text-xs">
                        {formData.clabeAccountIds.length}/{clabeAccounts.length} seleccionadas
                      </span>
                    </div>

                    <p className="text-white/40 text-xs">
                      Selecciona las cuentas CLABE a las que el usuario tendrá acceso para ver transacciones
                    </p>

                    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
                      {/* Select All Header */}
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-colors"
                        onClick={toggleAllClabeAccounts}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllClabeAccounts();
                            }}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              formData.clabeAccountIds.length === clabeAccounts.length
                                ? 'bg-purple-500 border-purple-500'
                                : formData.clabeAccountIds.length > 0
                                ? 'bg-purple-500/50 border-purple-500/50'
                                : 'border-white/20 hover:border-white/40'
                            }`}
                          >
                            {formData.clabeAccountIds.length === clabeAccounts.length && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                            {formData.clabeAccountIds.length > 0 && formData.clabeAccountIds.length < clabeAccounts.length && (
                              <div className="w-2 h-0.5 bg-white rounded" />
                            )}
                          </button>
                          <span className="text-white font-medium text-sm">
                            Seleccionar todas
                          </span>
                        </div>
                      </div>

                      {/* CLABE Accounts List */}
                      {loadingClabeAccounts ? (
                        <div className="px-4 py-6 text-center">
                          <Loader2 className="w-5 h-5 text-purple-400 animate-spin mx-auto" />
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          {clabeAccounts.map((account) => {
                            const isSelected = formData.clabeAccountIds.includes(account.id);

                            return (
                              <label
                                key={account.id}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors border-b border-white/[0.04] last:border-b-0"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleClabeAccess(account.id)}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? 'bg-purple-500 border-purple-500'
                                      : 'border-white/20 hover:border-white/40'
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-3.5 h-3.5 text-white/40" />
                                    <span className="text-white/80 text-sm font-medium">
                                      {account.alias}
                                    </span>
                                  </div>
                                  <p className="text-white/40 text-xs font-mono mt-0.5">
                                    {account.clabe}
                                  </p>
                                  {account.description && (
                                    <p className="text-white/30 text-xs mt-0.5 truncate">
                                      {account.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {formData.role === 'user' && formData.clabeAccountIds.length === 0 && (
                      <p className="text-yellow-400/70 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Los usuarios necesitan al menos una cuenta CLABE para ver transacciones
                      </p>
                    )}
                  </div>
                )}

                {/* Note for company_admin */}
                {formData.role === 'company_admin' && (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-blue-400/80 text-xs flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" />
                      Los administradores de empresa tienen acceso a todas las cuentas CLABE de su empresa
                    </p>
                  </div>
                )}
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
                  {selectedUser ? 'Guardar cambios' : 'Crear usuario'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {isDeleteModalOpen && selectedUser && (
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
                  Eliminar usuario
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  ¿Estás seguro de que deseas eliminar a{' '}
                  <span className="text-white font-medium">{selectedUser.name}</span>?
                  Esta acción no se puede deshacer.
                </p>

                {/* Error message in delete modal */}
                {error && (
                  <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm text-left">
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
                    disabled={saving}
                    className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileHover={{ scale: saving ? 1 : 1.02 }}
                    whileTap={{ scale: saving ? 1 : 0.98 }}
                    onClick={handleDeleteConfirm}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Eliminando...' : 'Eliminar'}
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
