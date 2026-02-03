import { Eye, Edit3, Check, X } from 'lucide-react';
import type { AllPersonFieldsResponse, PersonField } from '../../types';

interface FieldPermissionsEditorProps {
  allFields: AllPersonFieldsResponse | undefined;
  visibleFields: string[] | null;
  editableFields: string[] | null;
  useCustom: boolean;
  onChange: (
    visible: string[] | null,
    editable: string[] | null,
    useCustom: boolean
  ) => void;
}

export default function FieldPermissionsEditor({
  allFields,
  visibleFields,
  editableFields,
  useCustom,
  onChange,
}: FieldPermissionsEditorProps) {
  const toggleVisible = (fieldId: string) => {
    const current = visibleFields || [];
    let updated: string[];
    let newEditable = editableFields || [];

    if (current.includes(fieldId)) {
      // Remove from visible - also remove from editable
      updated = current.filter((id) => id !== fieldId);
      newEditable = newEditable.filter((id) => id !== fieldId);
    } else {
      updated = [...current, fieldId];
    }
    onChange(updated, newEditable, true);
  };

  const toggleEditable = (fieldId: string) => {
    const currentEditable = editableFields || [];
    const currentVisible = visibleFields || [];
    let updatedEditable: string[];
    let updatedVisible = currentVisible;

    if (currentEditable.includes(fieldId)) {
      updatedEditable = currentEditable.filter((id) => id !== fieldId);
    } else {
      updatedEditable = [...currentEditable, fieldId];
      // Editable implies visible
      if (!currentVisible.includes(fieldId)) {
        updatedVisible = [...currentVisible, fieldId];
      }
    }
    onChange(updatedVisible, updatedEditable, true);
  };

  const selectAllVisible = () => {
    if (!allFields) return;
    const allIds = [
      ...allFields.standard_fields.map((f) => f.id),
      ...allFields.dynamic_fields.map((f) => f.id),
    ];
    onChange(allIds, editableFields, true);
  };

  const selectNoneVisible = () => {
    onChange([], [], true);
  };

  const selectAllEditable = () => {
    if (!allFields) return;
    const allIds = [
      ...allFields.standard_fields.map((f) => f.id),
      ...allFields.dynamic_fields.map((f) => f.id),
    ];
    onChange(allIds, allIds, true);
  };

  const renderFieldRow = (field: PersonField) => {
    const isVisible = visibleFields?.includes(field.id) ?? false;
    const isEditable = editableFields?.includes(field.id) ?? false;

    return (
      <tr key={field.id} className="border-b border-[#334155] table-row-hover">
        <td className="px-4 py-3">
          <div>
            <span className="text-white">{field.label}</span>
            <span className="text-gray-500 text-sm ml-2">({field.name})</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => toggleVisible(field.id)}
            className={`p-2 rounded-lg transition-colors ${
              isVisible
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-card text-gray-500 hover:text-gray-300 border border-[#334155]'
            }`}
          >
            {isVisible ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3 text-center">
          <button
            type="button"
            onClick={() => toggleEditable(field.id)}
            className={`p-2 rounded-lg transition-colors ${
              isEditable
                ? 'bg-success-500/20 text-success-400 border border-success-500/30'
                : 'bg-dark-card text-gray-500 hover:text-gray-300 border border-[#334155]'
            }`}
          >
            {isEditable ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toggle: Inherit from roles vs. Custom */}
      <div className="p-4 bg-dark-card/60 rounded-lg border border-[#334155]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) =>
              onChange(
                e.target.checked ? [] : null,
                e.target.checked ? [] : null,
                e.target.checked
              )
            }
            className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-gray-700 text-primary-600"
          />
          <div>
            <span className="text-white font-medium">
              Individuelle Feld-Berechtigungen
            </span>
            <p className="text-sm text-gray-400 mt-1">
              Wenn aktiviert, werden die Feld-Berechtigungen der zugewiesenen Rollen
              ignoriert und die hier ausgewählten Felder verwendet.
            </p>
          </div>
        </label>
      </div>

      {!useCustom && (
        <div className="p-4 bg-primary-500/5 rounded-lg border border-primary-500/20">
          <p className="text-gray-400">
            <Eye className="w-4 h-4 inline mr-2 text-primary-400" />
            Die Feld-Berechtigungen werden von den zugewiesenen Rollen geerbt.
          </p>
        </div>
      )}

      {useCustom && (
        <>
          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              className="btn-secondary text-sm"
            >
              Alle sichtbar
            </button>
            <button
              type="button"
              onClick={selectAllEditable}
              className="btn-secondary text-sm"
            >
              Alle bearbeitbar
            </button>
            <button
              type="button"
              onClick={selectNoneVisible}
              className="btn-secondary text-sm"
            >
              Keine
            </button>
          </div>

          {/* Standard Fields */}
          {allFields?.standard_fields && allFields.standard_fields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-dark-card rounded text-xs border border-[#334155]">Standard</span>
                Basis-Felder
              </h4>
              <div className="glass rounded-lg border border-[#334155] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#334155] bg-dark-card/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                        Feld
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase w-24">
                        <Eye className="w-4 h-4 inline mr-1" />
                        Sichtbar
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase w-24">
                        <Edit3 className="w-4 h-4 inline mr-1" />
                        Bearbeitbar
                      </th>
                    </tr>
                  </thead>
                  <tbody>{allFields.standard_fields.map(renderFieldRow)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dynamic Fields */}
          {allFields?.dynamic_fields && allFields.dynamic_fields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs border border-primary-500/30">
                  Dynamisch
                </span>
                Zusatzfelder
              </h4>
              <div className="glass rounded-lg border border-[#334155] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#334155] bg-dark-card/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                        Feld
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase w-24">
                        <Eye className="w-4 h-4 inline mr-1" />
                        Sichtbar
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-400 uppercase w-24">
                        <Edit3 className="w-4 h-4 inline mr-1" />
                        Bearbeitbar
                      </th>
                    </tr>
                  </thead>
                  <tbody>{allFields.dynamic_fields.map(renderFieldRow)}</tbody>
                </table>
              </div>
            </div>
          )}

          {(!allFields?.dynamic_fields || allFields.dynamic_fields.length === 0) && (
            <p className="text-gray-500 text-sm">
              Keine Zusatzfelder definiert. Erstelle Felder unter "Feld-Verwaltung".
            </p>
          )}

          {/* Summary */}
          <div className="p-3 bg-primary-500/5 rounded-lg border border-primary-500/20 text-sm text-gray-400">
            <strong className="text-white">Zusammenfassung:</strong>{' '}
            {visibleFields?.length || 0} Felder sichtbar,{' '}
            {editableFields?.length || 0} Felder bearbeitbar
          </div>
        </>
      )}
    </div>
  );
}
