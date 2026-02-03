import { Camera, Search, Eye, Image, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
// DISABLED: QR/Barcode imports temporarily disabled
// import { QrCode, Barcode } from 'lucide-react';
import type { ScannerConfig, AllPersonFieldsResponse, ScannerResultDisplayConfig } from '../../types';

interface ScannerConfigEditorProps {
  config: ScannerConfig;
  onChange: (config: ScannerConfig) => void;
}

// DISABLED: QR/Barcode modes removed - was:
// { id: 'qr' as const, label: 'QR-Code', icon: QrCode },
// { id: 'barcode' as const, label: 'Barcode', icon: Barcode },
const SCANNER_MODES = [
  { id: 'face' as const, label: 'Gesichtserkennung', icon: Camera },
  { id: 'text' as const, label: 'Textsuche', icon: Search },
];

// DISABLED: QR/Barcode search fields removed - was:
// { id: 'qr_code', label: 'QR-Code' },
// { id: 'barcode', label: 'Barcode' },
const SEARCHABLE_FIELDS = [
  { id: 'first_name', label: 'Vorname' },
  { id: 'last_name', label: 'Nachname' },
  { id: 'email', label: 'E-Mail' },
  { id: 'phone', label: 'Telefon' },
  { id: 'personnel_number', label: 'Personalnummer' },
];

// Default result display config
const defaultResultDisplay: ScannerResultDisplayConfig = {
  show_photo: true,
  show_compliance_status: true,
  visible_fields: ['first_name', 'last_name', 'personnel_number'],
};

// DISABLED: QR/Barcode modes removed from enabled_modes - was ['face', 'qr', 'barcode', 'text']
export const defaultScannerConfig: ScannerConfig = {
  enabled_modes: ['face', 'text'],
  default_mode: 'face',
  text_search: {
    enabled_fields: ['last_name', 'personnel_number', 'email'],
    default_fields: ['last_name'],
    max_results: 10,
  },
  face_recognition: {
    show_confidence: true,
    min_confidence: 70,
  },
  result_display: defaultResultDisplay,
};

export default function ScannerConfigEditor({ config, onChange }: ScannerConfigEditorProps) {
  // Fetch all available person fields
  const { data: allFields } = useQuery({
    queryKey: ['all-person-fields'],
    queryFn: async () => {
      const response = await api.get('/fields/all-person-fields');
      return response.data as AllPersonFieldsResponse;
    },
  });

  // Get result display config with defaults
  const resultDisplay = config.result_display || defaultResultDisplay;

  // DISABLED: QR/Barcode types removed - was 'face' | 'qr' | 'barcode' | 'text'
  const toggleMode = (modeId: 'face' | 'text') => {
    const current = config.enabled_modes || [];
    let updated: typeof current;

    if (current.includes(modeId)) {
      updated = current.filter((m) => m !== modeId);
    } else {
      updated = [...current, modeId];
    }

    // Ensure at least one mode is selected
    if (updated.length === 0) {
      return;
    }

    // Update default_mode if it was removed
    let newDefaultMode = config.default_mode;
    if (!updated.includes(config.default_mode)) {
      newDefaultMode = updated[0];
    }

    onChange({
      ...config,
      enabled_modes: updated,
      default_mode: newDefaultMode,
    });
  };

  const toggleSearchField = (fieldId: string) => {
    const current = config.text_search?.enabled_fields || [];
    let updated: string[];

    if (current.includes(fieldId)) {
      updated = current.filter((f) => f !== fieldId);
      // Also remove from default_fields
      const newDefaults = (config.text_search?.default_fields || []).filter(
        (f) => f !== fieldId
      );
      onChange({
        ...config,
        text_search: {
          ...config.text_search,
          enabled_fields: updated,
          default_fields: newDefaults,
        },
      });
    } else {
      updated = [...current, fieldId];
      onChange({
        ...config,
        text_search: {
          ...config.text_search,
          enabled_fields: updated,
        },
      });
    }
  };

  const toggleDefaultField = (fieldId: string) => {
    const current = config.text_search?.default_fields || [];
    let updated: string[];

    if (current.includes(fieldId)) {
      updated = current.filter((f) => f !== fieldId);
    } else {
      updated = [...current, fieldId];
    }

    onChange({
      ...config,
      text_search: {
        ...config.text_search,
        default_fields: updated,
      },
    });
  };

  const toggleResultDisplayField = (fieldId: string) => {
    const current = resultDisplay.visible_fields || [];
    let updated: string[];

    if (current.includes(fieldId)) {
      updated = current.filter((f) => f !== fieldId);
    } else {
      updated = [...current, fieldId];
    }

    onChange({
      ...config,
      result_display: {
        ...resultDisplay,
        visible_fields: updated,
      },
    });
  };

  const selectAllDisplayFields = () => {
    const allFieldIds: string[] = [];

    // Add standard fields
    if (allFields?.standard_fields) {
      allFieldIds.push(...allFields.standard_fields.map(f => f.id));
    }

    // Add dynamic fields (non-system only)
    if (allFields?.dynamic_fields) {
      allFieldIds.push(...allFields.dynamic_fields.filter(f => !f.name.startsWith('_')).map(f => f.id));
    }

    onChange({
      ...config,
      result_display: {
        ...resultDisplay,
        visible_fields: allFieldIds,
      },
    });
  };

  const deselectAllDisplayFields = () => {
    onChange({
      ...config,
      result_display: {
        ...resultDisplay,
        visible_fields: [],
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Verfügbare Scanner-Modi */}
      <section>
        <h3 className="text-lg font-medium text-white mb-3">Verfügbare Scanner-Funktionen</h3>
        <p className="text-sm text-gray-400 mb-4">
          Wähle aus, welche Scanner-Modi für Benutzer mit dieser Rolle verfügbar sind.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SCANNER_MODES.map((mode) => {
            const Icon = mode.icon;
            const isEnabled = config.enabled_modes?.includes(mode.id);
            return (
              <label
                key={mode.id}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  isEnabled
                    ? 'border-primary-500/50 bg-primary-500/10 shadow-glow-sm'
                    : 'border-[#334155] bg-dark-card/50 hover:border-primary-500/30'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleMode(mode.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                />
                <Icon className={`w-5 h-5 ${isEnabled ? 'text-primary-400' : 'text-gray-400'}`} />
                <span className={isEnabled ? 'text-white' : 'text-gray-300'}>{mode.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Standard-Modus */}
      <section>
        <h3 className="text-lg font-medium text-white mb-3">Standard-Modus beim Öffnen</h3>
        <p className="text-sm text-gray-400 mb-4">
          Welcher Modus soll beim Öffnen des Scanners aktiv sein?
        </p>
        <select
          value={config.default_mode}
          onChange={(e) =>
            onChange({ ...config, default_mode: e.target.value as ScannerConfig['default_mode'] })
          }
          className="input max-w-xs"
        >
          {config.enabled_modes?.map((modeId) => {
            const mode = SCANNER_MODES.find((m) => m.id === modeId);
            return (
              <option key={modeId} value={modeId}>
                {mode?.label || modeId}
              </option>
            );
          })}
        </select>
      </section>

      {/* Treffer-Anzeige Konfiguration */}
      <section className="border-t border-[#334155] pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-medium text-white">Treffer-Anzeige</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Welche Informationen sollen bei einem erkannten Treffer angezeigt werden?
        </p>

        {/* Special Fields: Photo & Compliance */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Spezielle Anzeigen
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                resultDisplay.show_photo
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-[#334155] bg-dark-card/50 hover:border-primary-500/30'
              }`}
            >
              <input
                type="checkbox"
                checked={resultDisplay.show_photo}
                onChange={(e) =>
                  onChange({
                    ...config,
                    result_display: {
                      ...resultDisplay,
                      show_photo: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
              />
              <Image className={`w-4 h-4 ${resultDisplay.show_photo ? 'text-primary-400' : 'text-gray-400'}`} />
              <span className={resultDisplay.show_photo ? 'text-white' : 'text-gray-300'}>Foto</span>
            </label>

            <label
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                resultDisplay.show_compliance_status
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-[#334155] bg-dark-card/50 hover:border-primary-500/30'
              }`}
            >
              <input
                type="checkbox"
                checked={resultDisplay.show_compliance_status}
                onChange={(e) =>
                  onChange({
                    ...config,
                    result_display: {
                      ...resultDisplay,
                      show_compliance_status: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
              />
              <ShieldCheck className={`w-4 h-4 ${resultDisplay.show_compliance_status ? 'text-primary-400' : 'text-gray-400'}`} />
              <span className={resultDisplay.show_compliance_status ? 'text-white' : 'text-gray-300'}>Compliance-Status</span>
            </label>
          </div>
        </div>

        {/* Standard Person Fields */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Stammdaten
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllDisplayFields}
                className="text-xs text-green-400 hover:text-green-300"
              >
                Alle aktivieren
              </button>
              <span className="text-gray-600">|</span>
              <button
                type="button"
                onClick={deselectAllDisplayFields}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Alle deaktivieren
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allFields?.standard_fields?.map((field) => {
              const isEnabled = resultDisplay.visible_fields?.includes(field.id);
              return (
                <label
                  key={field.id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    isEnabled ? 'bg-primary-500/10' : 'hover:bg-dark-card/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggleResultDisplayField(field.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                  />
                  <span className={isEnabled ? 'text-white' : 'text-gray-400'}>
                    {field.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Dynamic Fields */}
        {allFields?.dynamic_fields && allFields.dynamic_fields.filter(f => f.field_type !== 'photo' && f.field_type !== 'document').length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Zusätzliche Felder
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allFields.dynamic_fields
                .filter(f => f.field_type !== 'photo' && f.field_type !== 'document') // Exclude photo/document fields here
                .map((field) => {
                  const isEnabled = resultDisplay.visible_fields?.includes(field.id);
                  return (
                    <label
                      key={field.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isEnabled ? 'bg-primary-500/10' : 'hover:bg-dark-card/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleResultDisplayField(field.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      <span className={isEnabled ? 'text-white' : 'text-gray-400'}>
                        {field.label}
                      </span>
                      {field.category && (
                        <span className="text-xs text-gray-500">({field.category})</span>
                      )}
                    </label>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {/* Text-Suche Konfiguration */}
      {config.enabled_modes?.includes('text') && (
        <section className="border-t border-[#334155] pt-6">
          <h3 className="text-lg font-medium text-white mb-3">Textsuche-Konfiguration</h3>

          <div className="space-y-6">
            {/* Durchsuchbare Felder */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Durchsuchbare Felder
              </label>
              <p className="text-sm text-gray-400 mb-3">
                Welche Felder können bei der Textsuche durchsucht werden?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SEARCHABLE_FIELDS.map((field) => {
                  const isEnabled = config.text_search?.enabled_fields?.includes(field.id);
                  return (
                    <label
                      key={field.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isEnabled ? 'bg-primary-500/10' : 'hover:bg-dark-card/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleSearchField(field.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      <span className={isEnabled ? 'text-white' : 'text-gray-400'}>
                        {field.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Standard-Suchfelder */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Standard-Suchfelder
              </label>
              <p className="text-sm text-gray-400 mb-3">
                Welche Felder sind beim Öffnen des Scanners vorausgewählt?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(config.text_search?.enabled_fields || []).map((fieldId) => {
                  const field = SEARCHABLE_FIELDS.find((f) => f.id === fieldId);
                  const isDefault = config.text_search?.default_fields?.includes(fieldId);
                  return (
                    <label
                      key={fieldId}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isDefault ? 'bg-primary-500/10' : 'hover:bg-dark-card/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={() => toggleDefaultField(fieldId)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
                      />
                      <span className={isDefault ? 'text-white' : 'text-gray-400'}>
                        {field?.label || fieldId}
                      </span>
                    </label>
                  );
                })}
              </div>
              {(config.text_search?.enabled_fields || []).length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Wähle zuerst durchsuchbare Felder aus.
                </p>
              )}
            </div>

            {/* Max. Suchergebnisse */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max. Suchergebnisse
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={config.text_search?.max_results || 10}
                onChange={(e) =>
                  onChange({
                    ...config,
                    text_search: {
                      ...config.text_search,
                      max_results: parseInt(e.target.value) || 10,
                    },
                  })
                }
                className="input w-24"
              />
            </div>
          </div>
        </section>
      )}

      {/* Gesichtserkennung Konfiguration */}
      {config.enabled_modes?.includes('face') && (
        <section className="border-t border-[#334155] pt-6">
          <h3 className="text-lg font-medium text-white mb-3">Gesichtserkennung</h3>

          <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-card/50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={config.face_recognition?.show_confidence ?? true}
              onChange={(e) =>
                onChange({
                  ...config,
                  face_recognition: {
                    ...config.face_recognition,
                    show_confidence: e.target.checked,
                  },
                })
              }
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600"
            />
            <div>
              <span className="text-white">Konfidenz-Score anzeigen</span>
              <p className="text-sm text-gray-400">
                Zeigt den Übereinstimmungs-Prozentsatz bei erkannten Gesichtern an.
              </p>
            </div>
          </label>
        </section>
      )}
    </div>
  );
}
