import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { FieldDefinition, ComplianceCheckType, ComplianceRule } from '../../types';
import { Plus, Edit, Trash2, GripVertical, Settings, Lock, ShieldCheck } from 'lucide-react';

// DISABLED: QR/Barcode field types temporarily disabled
// qr_code: 'QR-Code',
// barcode: 'Barcode',
const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  textarea: 'Textbereich',
  email: 'E-Mail',
  number: 'Zahl',
  date: 'Datum',
  date_expiry: 'Ablaufdatum',
  checkbox: 'Checkbox',
  dropdown: 'Auswahl',
  photo: 'Foto',
  document: 'Dokument',
};

// Compliance check types per field type
const complianceCheckTypes: Record<string, { value: ComplianceCheckType; label: string }[]> = {
  date: [
    { value: 'date_not_expired', label: 'Datum nicht abgelaufen' },
    { value: 'date_before', label: 'Datum vor...' },
    { value: 'date_after', label: 'Datum nach...' },
  ],
  date_expiry: [
    { value: 'date_not_expired', label: 'Datum nicht abgelaufen' },
    { value: 'date_before', label: 'Datum vor...' },
    { value: 'date_after', label: 'Datum nach...' },
  ],
  checkbox: [
    { value: 'checkbox_is_true', label: 'Muss aktiviert sein' },
    { value: 'checkbox_is_false', label: 'Muss deaktiviert sein' },
  ],
  dropdown: [
    { value: 'value_equals', label: 'Wert muss gleich...' },
    { value: 'value_not_equals', label: 'Wert darf nicht gleich...' },
    { value: 'not_empty', label: 'Muss ausgefüllt sein' },
  ],
  text: [
    { value: 'value_equals', label: 'Wert muss gleich...' },
    { value: 'value_not_equals', label: 'Wert darf nicht gleich...' },
    { value: 'not_empty', label: 'Muss ausgefüllt sein' },
  ],
  textarea: [
    { value: 'not_empty', label: 'Muss ausgefüllt sein' },
  ],
  email: [
    { value: 'not_empty', label: 'Muss ausgefüllt sein' },
  ],
  number: [
    { value: 'number_greater_than', label: 'Zahl größer als...' },
    { value: 'number_less_than', label: 'Zahl kleiner als...' },
    { value: 'not_empty', label: 'Muss ausgefüllt sein' },
  ],
};

export default function FieldManager() {
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const { data: fields, isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: async () => {
      const response = await api.get('/fields');
      return response.data.items as FieldDefinition[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/fields/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fields'] }),
  });

  // Group fields by category
  const groupedFields = fields?.reduce((acc, field) => {
    const category = field.category || 'Allgemein';
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  const handleDelete = (field: FieldDefinition) => {
    if (field.is_system) {
      alert('Systemfelder können nicht gelöscht werden.');
      return;
    }
    if (confirm(`Feld "${field.label}" wirklich löschen?`)) {
      deleteMutation.mutate(field.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feld-Verwaltung</h1>
          <p className="text-gray-400 mt-1">Definiere dynamische Felder für Personen</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Neues Feld
        </button>
      </div>

      {/* Field List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : !fields?.length ? (
        <div className="glass rounded-xl p-12 border border-[#334155] text-center">
          <Settings className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Noch keine Felder definiert</h3>
          <p className="text-gray-400 mb-4">
            Erstelle dein erstes dynamisches Feld, um Personeninformationen zu erfassen.
          </p>
          <button onClick={() => setIsCreating(true)} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Erstes Feld erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFields || {}).map(([category, categoryFields]) => (
            <div key={category} className="glass rounded-xl border border-[#334155]">
              <div className="px-4 py-3 border-b border-[#334155]">
                <h2 className="text-lg font-semibold text-white">{category}</h2>
              </div>
              <div className="divide-y divide-[#334155]">
                {categoryFields.map((field) => (
                  <div
                    key={field.id}
                    className="px-4 py-3 flex items-center gap-4 hover:bg-primary-500/5 transition-colors"
                  >
                    <GripVertical className="w-5 h-5 text-gray-500 cursor-move" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{field.label}</span>
                        {field.is_system && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300">
                            <Lock className="w-3 h-3" />
                            System
                          </span>
                        )}
                        {field.is_required && (
                          <span className="badge badge-danger text-xs">Pflicht</span>
                        )}
                        {field.configuration?.compliance_rules?.check_type && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400">
                            <ShieldCheck className="w-3 h-3" />
                            Compliance
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-400">
                          {fieldTypeLabels[field.field_type] || field.field_type}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-sm text-gray-500">{field.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingField(field)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {!field.is_system && (
                        <button
                          onClick={() => handleDelete(field)}
                          className="p-2 text-gray-400 hover:text-danger-400 hover:bg-danger-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Editor Modal */}
      {(isCreating || editingField) && (
        <FieldEditor
          field={editingField}
          onClose={() => {
            setIsCreating(false);
            setEditingField(null);
          }}
        />
      )}
    </div>
  );
}

// Field Editor Component
function FieldEditor({
  field,
  onClose,
}: {
  field: FieldDefinition | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: field?.name || '',
    label: field?.label || '',
    field_type: field?.field_type || 'text',
    category: field?.category || '',
    is_required: field?.is_required || false,
    is_searchable: field?.is_searchable || false,
    configuration: field?.configuration || {},
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (field) {
        return api.put(`/fields/${field.id}`, data);
      }
      return api.post('/fields', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
      onClose();
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#334155] shadow-glass animate-fade-in-up">
        <div className="p-6 border-b border-[#334155]">
          <h2 className="text-xl font-semibold text-white">
            {field ? 'Feld bearbeiten' : 'Neues Feld erstellen'}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* System field notice */}
          {field?.is_system && (
            <div className="flex items-center gap-2 p-3 bg-warning-500/10 border border-warning-500/30 rounded-lg">
              <Lock className="w-4 h-4 text-warning-400" />
              <span className="text-sm text-warning-400">
                Systemfeld - Name und Typ können nicht geändert werden
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Interner Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. safety_shoes"
                className="input"
                disabled={field?.is_system}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Anzeigename *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="z.B. Sicherheitsschuhe"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Feldtyp *</label>
              <select
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value as FieldDefinition['field_type'] })}
                className="input"
                disabled={!!field}
              >
                {Object.entries(fieldTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Kategorie</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="z.B. Sicherheitsausrüstung"
                className="input"
              />
            </div>
          </div>

          {/* Dropdown Options */}
          {formData.field_type === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Optionen (eine pro Zeile)
              </label>
              <textarea
                value={(formData.configuration.options || []).join('\n')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    configuration: {
                      ...formData.configuration,
                      options: e.target.value.split('\n').filter((o) => o.trim()),
                    },
                  })
                }
                rows={4}
                className="input"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          )}

          {/* Date Expiry Config */}
          {formData.field_type === 'date_expiry' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Warnung (Tage)
                </label>
                <input
                  type="number"
                  value={formData.configuration.warning_days || 30}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      configuration: {
                        ...formData.configuration,
                        warning_days: parseInt(e.target.value),
                      },
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Kritisch (Tage)
                </label>
                <input
                  type="number"
                  value={formData.configuration.critical_days || 7}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      configuration: {
                        ...formData.configuration,
                        critical_days: parseInt(e.target.value),
                      },
                    })
                  }
                  className="input"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_required}
                onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
              />
              <span className="text-sm text-gray-300">Pflichtfeld</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_searchable}
                onChange={(e) => setFormData({ ...formData, is_searchable: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
              />
              <span className="text-sm text-gray-300">Durchsuchbar</span>
            </label>
          </div>

          {/* Compliance Rules Section */}
          <ComplianceRulesEditor
            fieldType={formData.field_type}
            complianceRules={formData.configuration.compliance_rules}
            onChange={(rules) =>
              setFormData({
                ...formData,
                configuration: {
                  ...formData.configuration,
                  compliance_rules: rules,
                },
              })
            }
          />
        </div>

        <div className="p-6 border-t border-[#334155] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !formData.name || !formData.label}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compliance Rules Editor Component
function ComplianceRulesEditor({
  fieldType,
  complianceRules,
  onChange,
}: {
  fieldType: string;
  complianceRules?: ComplianceRule;
  onChange: (rules: ComplianceRule | undefined) => void;
}) {
  const availableCheckTypes = complianceCheckTypes[fieldType] || [];
  const currentCheckType = complianceRules?.check_type;

  const updateRule = (key: keyof ComplianceRule, value: any) => {
    onChange({
      ...(complianceRules || {}),
      [key]: value,
    } as ComplianceRule);
  };

  const clearRules = () => {
    onChange(undefined);
  };

  // Don't show compliance section for photo/document types
  if (!availableCheckTypes.length) {
    return null;
  }

  return (
    <div className="border-t border-[#334155] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary-400" />
        <h3 className="text-sm font-semibold text-white">Compliance-Regeln</h3>
      </div>

      <div className="space-y-3">
        {/* Check Type Selection */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Prüfungstyp</label>
          <select
            value={currentCheckType || ''}
            onChange={(e) => {
              if (e.target.value) {
                updateRule('check_type', e.target.value as ComplianceCheckType);
              } else {
                clearRules();
              }
            }}
            className="input"
          >
            <option value="">Keine Prüfung</option>
            {availableCheckTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic options based on check type */}
        {currentCheckType === 'date_not_expired' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Warnung X Tage vorher
            </label>
            <input
              type="number"
              value={complianceRules?.warning_days ?? 30}
              onChange={(e) => updateRule('warning_days', parseInt(e.target.value) || 30)}
              min={0}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Status "Warnung" wenn das Datum in weniger als X Tagen abläuft
            </p>
          </div>
        )}

        {(currentCheckType === 'date_before' || currentCheckType === 'date_after') && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vergleichen mit</label>
              <select
                value={complianceRules?.compare_to || 'today'}
                onChange={(e) => updateRule('compare_to', e.target.value as 'today' | 'fixed_date')}
                className="input"
              >
                <option value="today">Heutiges Datum</option>
                <option value="fixed_date">Festes Datum</option>
              </select>
            </div>

            {complianceRules?.compare_to === 'fixed_date' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Datum</label>
                <input
                  type="date"
                  value={complianceRules?.compare_value as string || ''}
                  onChange={(e) => updateRule('compare_value', e.target.value)}
                  className="input"
                />
              </div>
            )}
          </div>
        )}

        {(currentCheckType === 'value_equals' || currentCheckType === 'value_not_equals') && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {currentCheckType === 'value_equals' ? 'Muss gleich sein' : 'Darf nicht gleich sein'}
            </label>
            <input
              type="text"
              value={complianceRules?.compare_value as string || ''}
              onChange={(e) => updateRule('compare_value', e.target.value)}
              placeholder="Vergleichswert eingeben"
              className="input"
            />
          </div>
        )}

        {(currentCheckType === 'number_greater_than' || currentCheckType === 'number_less_than') && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {currentCheckType === 'number_greater_than' ? 'Muss größer sein als' : 'Muss kleiner sein als'}
            </label>
            <input
              type="number"
              value={complianceRules?.compare_value as number || ''}
              onChange={(e) => updateRule('compare_value', parseFloat(e.target.value))}
              placeholder="Schwellenwert eingeben"
              className="input"
            />
          </div>
        )}

        {/* Custom Error Message */}
        {currentCheckType && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Fehlermeldung (optional)
            </label>
            <input
              type="text"
              value={complianceRules?.error_message || ''}
              onChange={(e) => updateRule('error_message', e.target.value)}
              placeholder="Standard-Fehlermeldung verwenden"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Wird angezeigt, wenn die Regel nicht erfüllt ist
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
