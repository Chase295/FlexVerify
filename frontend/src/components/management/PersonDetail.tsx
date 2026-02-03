import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Person, FieldDefinition, ComplianceStatus } from '../../types';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Camera,
  UserCircle,
  Trash2,
  Upload,
  X,
  RefreshCw,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import clsx from 'clsx';
import AuthenticatedImage from '../common/AuthenticatedImage';

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(id === 'new');
  const [showCamera, setShowCamera] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  // Fetch person
  const { data: person, isLoading: personLoading } = useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      if (id === 'new') return null;
      const response = await api.get<Person>(`/persons/${id}`);
      setFormData({
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        email: response.data.email || '',
        phone: response.data.phone || '',
        personnel_number: response.data.personnel_number || '',
        field_data: response.data.field_data || {},
      });
      return response.data;
    },
    enabled: id !== 'new',
  });

  // Fetch field definitions
  const { data: fieldsData } = useQuery({
    queryKey: ['fields'],
    queryFn: async () => {
      const response = await api.get('/fields');
      return response.data.items as FieldDefinition[];
    },
  });

  // Fetch compliance status
  const { data: compliance } = useQuery({
    queryKey: ['person-compliance', id],
    queryFn: async () => {
      if (id === 'new') return null;
      const response = await api.get<ComplianceStatus>(`/persons/${id}/compliance`);
      return response.data;
    },
    enabled: id !== 'new',
  });

  // Save mutation - creates person first, then uploads photo if pending
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (id === 'new') {
        return api.post('/persons', data);
      }
      return api.put(`/persons/${id}`, data);
    },
    onSuccess: async (response) => {
      const newPersonId = response.data.id;

      // If we have a pending photo, upload it now
      if (pendingPhotoFile && id === 'new') {
        const photoFormData = new FormData();
        photoFormData.append('file', pendingPhotoFile);
        try {
          await api.post(`/persons/${newPersonId}/photo`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (err) {
          console.error('Photo upload failed:', err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['person', id] });

      if (id === 'new') {
        navigate(`/persons/${newPersonId}`);
      } else {
        setIsEditing(false);
      }
    },
  });

  // Photo upload mutation (for existing persons)
  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/persons/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', id] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/persons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      navigate('/persons');
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (id === 'new') {
        // For new persons, store the photo to upload after creation
        setPendingPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          setPendingPhoto(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        // For existing persons, upload immediately
        photoMutation.mutate(file);
      }
    }
  };

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert base64 to File
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });

            if (id === 'new') {
              setPendingPhotoFile(file);
              setPendingPhoto(imageSrc);
            } else {
              photoMutation.mutate(file);
            }
            setShowCamera(false);
          });
      }
    }
  }, [id, photoMutation]);

  const removePendingPhoto = () => {
    setPendingPhoto(null);
    setPendingPhotoFile(null);
  };

  const handleDelete = () => {
    if (confirm('Person wirklich löschen?')) {
      deleteMutation.mutate();
    }
  };

  const updateFieldData = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      field_data: { ...prev.field_data, [fieldId]: value },
    }));
  };

  if (personLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const statusConfig = {
    valid: { icon: CheckCircle, color: 'text-success-400', bg: 'bg-success-500/15', border: 'border-success-500/30', label: 'Compliance OK' },
    warning: { icon: AlertTriangle, color: 'text-warning-400', bg: 'bg-warning-500/15', border: 'border-warning-500/30', label: 'Warnung' },
    expired: { icon: XCircle, color: 'text-danger-400', bg: 'bg-danger-500/15', border: 'border-danger-500/30', label: 'Abgelaufen' },
    pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', label: 'Ausstehend' },
  };

  const complianceStatus = compliance ? statusConfig[compliance.status] : statusConfig.pending;
  const ComplianceIcon = complianceStatus.icon;

  // Camera Modal
  if (showCamera) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
        <div className="p-4 flex items-center gap-4 bg-dark-secondary/90 backdrop-blur">
          <button
            onClick={() => setShowCamera(false)}
            className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-semibold text-white">Foto aufnehmen</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-[#334155]">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: 'environment',
                width: 720,
                height: 960,
              }}
              className="w-full h-full object-cover"
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-40 h-52 border-2 border-primary-400/40 rounded-full" />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={() => setShowCamera(false)}
              className="px-6 py-3 bg-dark-card text-gray-300 rounded-xl border border-[#334155] hover:bg-dark-elevated transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={capturePhoto}
              className="px-8 py-3 bg-gradient-primary text-white rounded-xl font-semibold shadow-glow hover:shadow-glow-lg transition-all"
            >
              <Camera className="w-5 h-5 mr-2 inline" />
              Aufnehmen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/persons')}
          className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {id === 'new' ? 'Neue Person' : person?.full_name}
          </h1>
        </div>
        {id !== 'new' && (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="btn-secondary">
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Speichern
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(true)} className="btn-primary">
                  Bearbeiten
                </button>
                <button onClick={handleDelete} className="btn-danger">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
        {id === 'new' && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !formData.first_name || !formData.last_name}
            className="btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Erstellen...' : 'Erstellen'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Photo & Status */}
        <div className="space-y-6">
          {/* Photo */}
          <div className="glass rounded-xl p-6 border border-[#334155]">
            <h2 className="text-lg font-semibold text-white mb-4">Foto</h2>
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 rounded-xl bg-dark-card flex items-center justify-center overflow-hidden mb-4 border border-[#334155] relative group">
                {pendingPhoto ? (
                  // Show pending photo for new persons
                  <>
                    <img
                      src={pendingPhoto}
                      alt="Vorschau"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={removePendingPhoto}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-danger-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : person?.has_photo ? (
                  <AuthenticatedImage
                    src={`/persons/${id}/photo`}
                    alt=""
                    className="w-full h-full object-cover"
                    fallbackClassName="w-24 h-24"
                  />
                ) : (
                  <UserCircle className="w-24 h-24 text-gray-500" />
                )}
                {person?.has_face_vectors && !pendingPhoto && (
                  <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-success-500/20 border border-success-500/30">
                    <CheckCircle className="w-4 h-4 text-success-400" />
                  </div>
                )}
              </div>

              {/* Photo upload buttons - always shown for new persons or when editing */}
              {(id === 'new' || isEditing) && (
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />

                  {/* Camera button - for mobile devices */}
                  <button
                    onClick={() => setShowCamera(true)}
                    disabled={photoMutation.isPending}
                    className="btn-secondary flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Kamera
                  </button>

                  {/* Upload button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoMutation.isPending}
                    className="btn-secondary flex-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {photoMutation.isPending ? 'Lädt...' : 'Hochladen'}
                  </button>
                </div>
              )}

              {/* Show upload button for existing persons when not editing */}
              {id !== 'new' && !isEditing && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCamera(true)}
                      disabled={photoMutation.isPending}
                      className="btn-secondary"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Kamera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={photoMutation.isPending}
                      className="btn-secondary"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {photoMutation.isPending ? 'Lädt...' : 'Hochladen'}
                    </button>
                  </div>
                </>
              )}

              {pendingPhoto && id === 'new' && (
                <p className="text-sm text-primary-400 mt-3 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  Foto wird nach dem Erstellen hochgeladen
                </p>
              )}

              {person?.has_face_vectors && (
                <p className="text-sm text-success-400 mt-3 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Face-ID aktiv
                </p>
              )}
            </div>
          </div>

          {/* Compliance Status */}
          {id !== 'new' && compliance && (
            <div className="glass rounded-xl p-6 border border-[#334155]">
              <h2 className="text-lg font-semibold text-white mb-4">Compliance-Status</h2>
              <div className={clsx('flex items-center gap-3 p-4 rounded-xl border', complianceStatus.bg, complianceStatus.border)}>
                <ComplianceIcon className={clsx('w-6 h-6', complianceStatus.color)} />
                <span className={clsx('font-semibold', complianceStatus.color)}>
                  {complianceStatus.label}
                </span>
              </div>

              {compliance.warnings.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-warning-400 mb-2">Warnungen</h3>
                  <ul className="space-y-1.5">
                    {compliance.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning-400 mt-0.5 flex-shrink-0" />
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {compliance.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-danger-400 mb-2">Fehler</h3>
                  <ul className="space-y-1.5">
                    {compliance.errors.map((e, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-danger-400 mt-0.5 flex-shrink-0" />
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="glass rounded-xl p-6 border border-[#334155]">
            <h2 className="text-lg font-semibold text-white mb-4">Stammdaten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Vorname *</label>
                <input
                  type="text"
                  value={formData.first_name || ''}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  disabled={!isEditing && id !== 'new'}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nachname *</label>
                <input
                  type="text"
                  value={formData.last_name || ''}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  disabled={!isEditing && id !== 'new'}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">E-Mail</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing && id !== 'new'}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Telefon</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing && id !== 'new'}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Personalnummer</label>
                <input
                  type="text"
                  value={formData.personnel_number || ''}
                  onChange={(e) => setFormData({ ...formData, personnel_number: e.target.value })}
                  disabled={!isEditing && id !== 'new'}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Fields - nur nicht-System-Felder anzeigen (Stammdaten sind bereits oben hardcodiert) */}
          {fieldsData && fieldsData.filter(f => !f.is_system && f.field_type !== 'qr_code' && f.field_type !== 'barcode').length > 0 && (
            <div className="glass rounded-xl p-6 border border-[#334155]">
              <h2 className="text-lg font-semibold text-white mb-4">Zusätzliche Felder</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fieldsData.filter(f => !f.is_system && f.field_type !== 'qr_code' && f.field_type !== 'barcode').map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label}
                      {field.is_required && ' *'}
                    </label>
                    {field.field_type === 'checkbox' ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.field_data?.[field.id] || false}
                          onChange={(e) => updateFieldData(field.id, e.target.checked)}
                          disabled={!isEditing && id !== 'new'}
                        />
                        <span className="text-sm text-gray-300">
                          {field.configuration?.label_true || 'Ja'}
                        </span>
                      </label>
                    ) : field.field_type === 'dropdown' ? (
                      <select
                        value={formData.field_data?.[field.id] || ''}
                        onChange={(e) => updateFieldData(field.id, e.target.value)}
                        disabled={!isEditing && id !== 'new'}
                        className="input"
                      >
                        <option value="">Bitte wählen</option>
                        {field.configuration?.options?.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.field_type === 'date' || field.field_type === 'date_expiry' ? (
                      <input
                        type="date"
                        value={formData.field_data?.[field.id] || ''}
                        onChange={(e) => updateFieldData(field.id, e.target.value)}
                        disabled={!isEditing && id !== 'new'}
                        className="input"
                      />
                    ) : (
                      <input
                        type={field.field_type === 'number' ? 'number' : 'text'}
                        value={formData.field_data?.[field.id] || ''}
                        onChange={(e) => updateFieldData(field.id, e.target.value)}
                        disabled={!isEditing && id !== 'new'}
                        className="input"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
