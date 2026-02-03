import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Role } from '../../types';
import { Plus, Edit, Trash2, Shield, LayoutDashboard, Users, FileText, Settings, ClipboardList } from 'lucide-react';
import ScannerConfigEditor, { defaultScannerConfig } from './ScannerConfigEditor';

// Permission groups with German labels
const permissionGroups = {
  'Dashboard': {
    icon: LayoutDashboard,
    permissions: [
      { key: 'dashboard.view', label: 'Dashboard anzeigen' },
      { key: 'dashboard.stats', label: 'Statistiken' },
      { key: 'dashboard.recent_persons', label: 'Letzte Personen' },
      { key: 'dashboard.compliance_overview', label: 'Compliance-Übersicht' },
      { key: 'dashboard.expiring_documents', label: 'Ablaufende Dokumente' },
      { key: 'dashboard.scan_activity', label: 'Scan-Aktivität' },
    ],
  },
  'Personen': {
    icon: Users,
    permissions: [
      { key: 'persons.read', label: 'Anzeigen' },
      { key: 'persons.create', label: 'Erstellen' },
      { key: 'persons.update', label: 'Bearbeiten' },
      { key: 'persons.delete', label: 'Löschen' },
    ],
  },
  'Felder': {
    icon: ClipboardList,
    permissions: [
      { key: 'fields.read', label: 'Anzeigen' },
      { key: 'fields.create', label: 'Erstellen' },
      { key: 'fields.update', label: 'Bearbeiten' },
      { key: 'fields.delete', label: 'Löschen' },
    ],
  },
  'Benutzer': {
    icon: Users,
    permissions: [
      { key: 'users.read', label: 'Anzeigen' },
      { key: 'users.create', label: 'Erstellen' },
      { key: 'users.update', label: 'Bearbeiten' },
      { key: 'users.delete', label: 'Löschen' },
    ],
  },
  'Rollen': {
    icon: Shield,
    permissions: [
      { key: 'roles.read', label: 'Anzeigen' },
      { key: 'roles.create', label: 'Erstellen' },
      { key: 'roles.update', label: 'Bearbeiten' },
      { key: 'roles.delete', label: 'Löschen' },
    ],
  },
  'Dokumente': {
    icon: FileText,
    permissions: [
      { key: 'documents.read', label: 'Anzeigen' },
      { key: 'documents.upload', label: 'Hochladen' },
      { key: 'documents.delete', label: 'Löschen' },
    ],
  },
  // NOTE: Erkennung (recognition.face, recognition.text) wurde entfernt,
  // da Scanner-Berechtigungen im Tab "Scanner" konfiguriert werden
  'Audit': {
    icon: ClipboardList,
    permissions: [
      { key: 'audit.read', label: 'Anzeigen' },
      { key: 'audit.export', label: 'Exportieren' },
    ],
  },
  'Einstellungen': {
    icon: Settings,
    permissions: [
      { key: 'settings.read', label: 'Anzeigen' },
      { key: 'settings.update', label: 'Bearbeiten' },
    ],
  },
};

export default function RoleManager() {
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.get('/roles');
      return response.data as Role[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  const handleDelete = (role: Role) => {
    if (confirm(`Rolle "${role.name}" wirklich löschen?`)) {
      deleteMutation.mutate(role.id);
    }
  };

  // Count active permissions per category
  const getPermissionSummary = (permissions: Record<string, boolean>) => {
    const summary: Record<string, number> = {};
    Object.entries(permissionGroups).forEach(([group, { permissions: perms }]) => {
      const active = perms.filter(p => permissions[p.key]).length;
      if (active > 0) {
        summary[group] = active;
      }
    });
    return summary;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rollen-Verwaltung</h1>
          <p className="text-gray-400 mt-1">Definiere Berechtigungen für Benutzergruppen</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Neue Rolle
        </button>
      </div>

      {/* Role List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          roles?.map((role) => {
            const permSummary = getPermissionSummary(role.permissions || {});
            const totalActive = Object.values(role.permissions || {}).filter(Boolean).length;

            return (
              <div
                key={role.id}
                className="glass rounded-xl p-6 border border-[#334155] card-hover"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-primary rounded-lg shadow-glow-sm">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{role.name}</h3>
                      <p className="text-sm text-gray-400">{role.description || 'Keine Beschreibung'}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Berechtigungen ({totalActive})</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(permSummary).length > 0 ? (
                      Object.entries(permSummary).map(([group, count]) => (
                        <span key={group} className="px-2 py-0.5 bg-dark-card rounded text-xs text-gray-300 border border-[#334155]">
                          {group}: {count}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">Keine Berechtigungen</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingRole(role)}
                    className="btn-secondary flex-1 py-2"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(role)}
                    className="btn-danger py-2 px-3"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Role Editor Modal */}
      {(isCreating || editingRole) && (
        <RoleEditor
          role={editingRole}
          onClose={() => {
            setIsCreating(false);
            setEditingRole(null);
          }}
        />
      )}
    </div>
  );
}

function RoleEditor({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'scanner'>('general');
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissions: role?.permissions || {},
    scanner_config: role?.scanner_config || defaultScannerConfig,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (role) {
        return api.put(`/roles/${role.id}`, data);
      }
      return api.post('/roles', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  const toggleGroup = (permissions: { key: string; label: string }[]) => {
    const keys = permissions.map(p => p.key);
    const allEnabled = keys.every((k) => formData.permissions[k]);
    const newPerms = { ...formData.permissions };
    keys.forEach((k) => {
      newPerms[k] = !allEnabled;
    });
    setFormData({ ...formData, permissions: newPerms });
  };

  const enableAll = () => {
    const newPerms: Record<string, boolean> = {};
    Object.values(permissionGroups).forEach(({ permissions }) => {
      permissions.forEach(p => {
        newPerms[p.key] = true;
      });
    });
    setFormData({ ...formData, permissions: newPerms });
  };

  const disableAll = () => {
    setFormData({ ...formData, permissions: {} });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#334155] shadow-glass animate-fade-in-up">
        <div className="p-6 border-b border-[#334155]">
          <h2 className="text-xl font-semibold text-white mb-4">
            {role ? 'Rolle bearbeiten' : 'Neue Rolle'}
          </h2>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#334155] -mb-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Allgemein
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'permissions'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Berechtigungen
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'scanner'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Scanner
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Tab: Allgemein */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="z.B. Site Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="Kurze Beschreibung der Rolle"
                />
              </div>
            </div>
          )}

          {/* Tab: Berechtigungen */}
          {activeTab === 'permissions' && (
            <div>
              <div className="flex justify-end gap-2 mb-4">
                <button onClick={enableAll} className="text-xs text-green-400 hover:text-green-300">
                  Alle aktivieren
                </button>
                <span className="text-gray-600">|</span>
                <button onClick={disableAll} className="text-xs text-red-400 hover:text-red-300">
                  Alle deaktivieren
                </button>
              </div>
              <div className="space-y-3">
                {Object.entries(permissionGroups).map(([group, { icon: Icon, permissions }]) => {
                  const activeCount = permissions.filter(p => formData.permissions[p.key]).length;

                  return (
                    <div key={group} className="bg-dark-card/60 rounded-lg p-4 border border-[#334155]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary-400" />
                          <span className="font-medium text-white">{group}</span>
                          <span className="text-xs text-gray-500">
                            ({activeCount}/{permissions.length})
                          </span>
                        </div>
                        <button
                          onClick={() => toggleGroup(permissions)}
                          className="text-xs text-primary-400 hover:text-primary-300 px-2 py-1 rounded bg-primary-500/10 border border-primary-500/30 transition-colors"
                        >
                          {activeCount === permissions.length ? 'Alle aus' : 'Alle an'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              formData.permissions[perm.key]
                                ? 'bg-primary-500/20 border border-primary-500/30'
                                : 'bg-dark-elevated/50 border border-[#334155] hover:bg-dark-elevated/70'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions[perm.key] || false}
                              onChange={() => togglePermission(perm.key)}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-300">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab: Scanner */}
          {activeTab === 'scanner' && (
            <ScannerConfigEditor
              config={formData.scanner_config}
              onChange={(config) => setFormData({ ...formData, scanner_config: config })}
            />
          )}
        </div>

        <div className="p-6 border-t border-[#334155] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Abbrechen
          </button>
          <button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending || !formData.name}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
