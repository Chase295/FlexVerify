import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Settings as SettingsIcon, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface RecognitionSettings {
  face_threshold: number;
  face_threshold_percent: number;
  model: string;
  description: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load current settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['recognition-settings'],
    queryFn: async () => {
      const response = await api.get('/recognition/settings');
      return response.data as RecognitionSettings;
    },
  });

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (newThreshold: number) => {
      const response = await api.put('/recognition/settings', {
        face_threshold_percent: newThreshold,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recognition-settings'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  // Use local state if set, otherwise use server value
  const currentThreshold = threshold ?? settings?.face_threshold_percent ?? 60;

  const handleSave = () => {
    updateMutation.mutate(currentThreshold);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThreshold(Number(e.target.value));
  };

  // Get color based on threshold
  const getThresholdColor = (value: number) => {
    if (value >= 80) return 'text-success-400';
    if (value >= 60) return 'text-warning-400';
    return 'text-danger-400';
  };

  const getThresholdBg = (value: number) => {
    if (value >= 80) return 'bg-success-500';
    if (value >= 60) return 'bg-warning-500';
    return 'bg-danger-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6 border border-danger-500/30">
        <div className="flex items-center gap-3 text-danger-400">
          <AlertCircle className="w-6 h-6" />
          <span>Fehler beim Laden der Einstellungen</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary-400" />
          Einstellungen
        </h1>
        <p className="text-gray-400 mt-1">Systemweite Konfiguration</p>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="glass rounded-xl p-4 border border-success-500/30 bg-success-500/10 flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-success-400" />
          <span className="text-success-400">Einstellungen erfolgreich gespeichert</span>
        </div>
      )}

      {/* Face Recognition Settings */}
      <div className="glass rounded-xl border border-[#334155] overflow-hidden">
        <div className="p-4 border-b border-[#334155] bg-dark-elevated/50">
          <h2 className="text-lg font-semibold text-white">Gesichtserkennung</h2>
          <p className="text-sm text-gray-400 mt-1">
            Konfigurieren Sie die Empfindlichkeit der Gesichtserkennung
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Threshold Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Mindest-Konfidenz für Match
              </label>
              <span className={`text-2xl font-bold ${getThresholdColor(currentThreshold)}`}>
                {currentThreshold.toFixed(1)}%
              </span>
            </div>

            {/* Custom Slider */}
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={currentThreshold}
                onChange={handleSliderChange}
                className="w-full h-3 bg-dark-card rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, ${
                    currentThreshold >= 80 ? '#22c55e' : currentThreshold >= 60 ? '#f59e0b' : '#ef4444'
                  } 0%, ${
                    currentThreshold >= 80 ? '#22c55e' : currentThreshold >= 60 ? '#f59e0b' : '#ef4444'
                  } ${currentThreshold}%, #1e293b ${currentThreshold}%, #1e293b 100%)`,
                }}
              />
              {/* Scale markers */}
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Explanation */}
            <div className="p-4 bg-dark-card/50 rounded-lg border border-[#334155]">
              <p className="text-sm text-gray-400">
                {currentThreshold >= 80 && (
                  <>
                    <span className="text-success-400 font-medium">Hoch:</span> Nur sehr sichere Matches werden akzeptiert.
                    Weniger Fehlerkennungen, aber manche Personen werden möglicherweise nicht erkannt.
                  </>
                )}
                {currentThreshold >= 60 && currentThreshold < 80 && (
                  <>
                    <span className="text-warning-400 font-medium">Mittel:</span> Ausgewogene Einstellung zwischen
                    Sicherheit und Benutzerfreundlichkeit.
                  </>
                )}
                {currentThreshold < 60 && (
                  <>
                    <span className="text-danger-400 font-medium">Niedrig:</span> Mehr Matches werden akzeptiert,
                    aber es kann zu Fehlerkennungen kommen.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Model Info */}
          <div className="flex items-center justify-between p-4 bg-dark-card/50 rounded-lg border border-[#334155]">
            <div>
              <p className="text-sm font-medium text-gray-300">Erkennungsmodell</p>
              <p className="text-xs text-gray-500 mt-0.5">Aktuell verwendetes Modell</p>
            </div>
            <span className="px-3 py-1 bg-primary-500/20 text-primary-400 text-sm font-medium rounded-full uppercase">
              {settings?.model || 'HOG'}
            </span>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-[#334155]">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending || threshold === null}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="glass rounded-xl p-4 border border-[#334155]">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Hinweise</h3>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Änderungen werden sofort wirksam für alle neuen Scans</li>
          <li>Bestehende Scan-Ergebnisse bleiben unverändert</li>
          <li>Der empfohlene Wert liegt zwischen 60-80%</li>
        </ul>
      </div>
    </div>
  );
}
