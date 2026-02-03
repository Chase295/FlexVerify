import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { User, Role, AllPersonFieldsResponse } from '../../types';
import { Plus, Edit, Trash2, UserCircle, Shield, Check, X, Scan, Settings, Eye } from 'lucide-react';
import FieldPermissionsEditor from './FieldPermissionsEditor';

export default function UserManager() {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingScannerUser, setIsCreatingScannerUser] = useState(false);
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles');
      return response.data as Role[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleDelete = (user: User) => {
    if (confirm(`Benutzer "${user.full_name}" wirklich deaktivieren?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Benutzer-Verwaltung</h1>
          <p className="text-gray-400 mt-1">Verwalte Systembenutzer und ihre Rollen</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreatingScannerUser(true)}
            className="btn-secondary flex items-center"
          >
            <Scan className="w-5 h-5 mr-2" />
            Scanner-User
          </button>
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Neuer Benutzer
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="glass rounded-xl border border-[#334155] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Benutzer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Rollen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {usersData?.items.map((user: User) => (
                  <tr key={user.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center border border-[#334155]">
                          <UserCircle className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium flex items-center gap-2">
                            {user.full_name}
                            {user.is_superadmin && (
                              <Shield className="w-4 h-4 text-primary-400" />
                            )}
                          </p>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.is_superadmin ? (
                          <span className="badge-info">Super Admin</span>
                        ) : user.roles?.length > 0 ? (
                          user.roles.map((role) => (
                            <span key={role.id} className="badge-neutral">
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">Keine Rollen</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="badge-success">
                          <Check className="w-3 h-3 mr-1" />
                          Aktiv
                        </span>
                      ) : (
                        <span className="badge-danger">
                          <X className="w-3 h-3 mr-1" />
                          Inaktiv
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!user.is_superadmin && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-gray-400 hover:text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Editor Modal */}
      {(isCreating || editingUser) && (
        <UserEditor
          user={editingUser}
          roles={roles || []}
          onClose={() => {
            setIsCreating(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Scanner User Quick Create Modal */}
      {isCreatingScannerUser && (
        <ScannerUserQuickCreate
          roles={roles || []}
          onClose={() => setIsCreatingScannerUser(false)}
        />
      )}
    </div>
  );
}

function UserEditor({
  user,
  roles,
  onClose,
}: {
  user: User | null;
  roles: Role[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'fields'>('general');

  // Load all person fields for field permissions editor
  const { data: allFields } = useQuery({
    queryKey: ['all-person-fields'],
    queryFn: async () => {
      const response = await api.get('/fields/all-person-fields');
      return response.data as AllPersonFieldsResponse;
    },
  });

  const [formData, setFormData] = useState({
    email: user?.email || '',
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    password: '',
    is_active: user?.is_active ?? true,
    role_ids: (user?.roles || []).map((r) => r.id),
    visible_fields: user?.visible_fields || null,
    editable_fields: user?.editable_fields || null,
  });

  const useCustomFieldPermissions =
    formData.visible_fields !== null || formData.editable_fields !== null;

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: any = { ...data };
      if (!payload.password) delete payload.password;

      // Handle field permissions
      if (payload.visible_fields === null && payload.editable_fields === null) {
        // Inherit from roles - send empty arrays to clear custom settings
        payload.visible_fields = [];
        payload.editable_fields = [];
      }

      if (user) {
        return api.put(`/users/${user.id}`, payload);
      }
      return api.post('/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter((id) => id !== roleId)
        : [...prev.role_ids, roleId],
    }));
  };

  const handleFieldPermissionsChange = (
    visible: string[] | null,
    editable: string[] | null,
    useCustom: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      visible_fields: useCustom ? visible : null,
      editable_fields: useCustom ? editable : null,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-[#334155] shadow-glass animate-fade-in-up">
        <div className="p-6 border-b border-[#334155]">
          <h2 className="text-xl font-semibold text-white">
            {user ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#334155]">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Allgemein
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'fields'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            Feld-Berechtigungen
            {useCustomFieldPermissions && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded">
                Individuell
              </span>
            )}
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">E-Mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {user ? 'Neues Passwort' : 'Passwort *'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={user ? 'Leer lassen für unverändert' : ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rollen</label>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.role_ids.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      <span className="text-gray-300">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {user && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                  />
                  <span className="text-gray-300">Aktiv</span>
                </label>
              )}
            </div>
          )}

          {activeTab === 'fields' && (
            <FieldPermissionsEditor
              allFields={allFields}
              visibleFields={formData.visible_fields}
              editableFields={formData.editable_fields}
              useCustom={useCustomFieldPermissions}
              onChange={handleFieldPermissionsChange}
            />
          )}
        </div>

        <div className="p-6 border-t border-[#334155] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Abbrechen
          </button>
          <button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScannerUserQuickCreate({
  roles,
  onClose,
}: {
  roles: Role[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Find scanner role (by name containing "Scanner" or "scanner")
  const scannerRole = roles.find(
    (r) => r.name.toLowerCase().includes('scanner')
  );

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role_ids: scannerRole ? [scannerRole.id] : [],
  });

  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return api.post('/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Fehler beim Erstellen');
    },
  });

  const handleSubmit = () => {
    if (!formData.email || !formData.full_name || !formData.password) {
      setError('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    if (formData.role_ids.length === 0) {
      setError('Keine Scanner-Rolle gefunden. Bitte erst eine Rolle mit "Scanner" im Namen erstellen.');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl max-w-md w-full border border-[#334155] shadow-glass animate-fade-in-up">
        <div className="p-6 border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-sm">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Scanner-User erstellen
              </h2>
              <p className="text-sm text-gray-400">
                Schnell einen reinen Scanner-Benutzer anlegen
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-500/20 border border-danger-500/50 rounded-lg text-danger-400 text-sm">
              {error}
            </div>
          )}

          {!scannerRole && (
            <div className="p-3 bg-warning-500/20 border border-warning-500/50 rounded-lg text-warning-400 text-sm">
              Keine Scanner-Rolle gefunden. Bitte erst unter "Rollen-Verwaltung" eine Rolle mit "Scanner" im Namen erstellen.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="z.B. Scanner Eingang 1"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">E-Mail *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="z.B. scanner1@firma.de"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Passwort *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Mindestens 6 Zeichen"
              className="input"
            />
          </div>

          {scannerRole && (
            <div className="p-3 bg-primary-500/10 rounded-lg border border-primary-500/30">
              <p className="text-sm text-gray-300">
                Zugewiesene Rolle:{' '}
                <span className="text-primary-400 font-medium">{scannerRole.name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Der Benutzer hat nur Zugriff auf die Scanner-Seite
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#334155] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending || !scannerRole}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Erstellen...' : 'Scanner-User erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
