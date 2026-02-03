import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Webcam from 'react-webcam';
import api from '../../services/api';
import type { FaceSearchResponse, ScannerConfig } from '../../types';
import {
  Camera,
  // QrCode, // DISABLED: QR/Barcode feature temporarily disabled
  Search,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  User,
  LogOut,
  ZoomIn,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import AuthenticatedImage from '../common/AuthenticatedImage';
import PhotoLightbox from '../common/PhotoLightbox';

type ScanMode = 'home' | 'camera' | 'text' | 'result';
// DISABLED: QR mode removed - was 'home' | 'camera' | 'qr' | 'text' | 'result'

// Default scanner config fallback
// DISABLED: QR/Barcode modes removed from enabled_modes - was ['face', 'qr', 'barcode', 'text']
const defaultScannerConfig: ScannerConfig = {
  enabled_modes: ['face', 'text'],
  default_mode: 'face',
  text_search: {
    enabled_fields: ['first_name', 'last_name', 'personnel_number', 'email'],
    default_fields: ['last_name'],
    max_results: 10,
  },
  face_recognition: {
    show_confidence: true,
    min_confidence: 70,
  },
};

export default function ScannerHome() {
  const [mode, setMode] = useState<ScanMode>('home');
  const [result, setResult] = useState<FaceSearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; isAuthenticated?: boolean } | null>(null);
  const webcamRef = useRef<Webcam>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Load scanner config for current user
  const { data: scannerConfig, isLoading: configLoading } = useQuery({
    queryKey: ['my-scanner-config'],
    queryFn: async () => {
      const response = await api.get('/recognition/my-scanner-config');
      return response.data as ScannerConfig;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Use loaded config or fallback
  const config = scannerConfig || defaultScannerConfig;

  // Face search mutation
  const faceMutation = useMutation({
    mutationFn: async (imageData: string) => {
      // Convert base64 to blob
      const res = await fetch(imageData);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append('file', blob, 'capture.jpg');

      const response = await api.post<FaceSearchResponse>('/recognition/face-search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setMode('result');
    },
  });

  // Text search mutation - uses config fields and limit
  const textMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await api.post('/recognition/text-search', {
        query,
        fields: config.text_search.default_fields.length > 0
          ? config.text_search.default_fields
          : config.text_search.enabled_fields,
        limit: config.text_search.max_results,
      });
      return response.data;
    },
  });

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      faceMutation.mutate(imageSrc);
    }
  }, [faceMutation]);

  const handleTextSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      textMutation.mutate(searchQuery);
    }
  };

  const resetScanner = () => {
    setMode('home');
    setResult(null);
    setSearchQuery('');
    setCapturedImage(null);
    setLightboxImage(null);
    faceMutation.reset();
    textMutation.reset();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Check if a mode is enabled
  // DISABLED: QR/Barcode types removed - was 'face' | 'qr' | 'barcode' | 'text'
  const isModeEnabled = (modeType: 'face' | 'text') => {
    return config.enabled_modes.includes(modeType);
  };

  // DISABLED: QR/Barcode feature temporarily disabled
  // const isQrOrBarcodeEnabled = isModeEnabled('qr') || isModeEnabled('barcode');

  // Home screen
  if (mode === 'home') {
    // Show loading while config is being fetched
    if (configLoading) {
      return (
        <div className="min-h-screen bg-dark-primary flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
          <p className="mt-4 text-gray-400">Scanner wird geladen...</p>
        </div>
      );
    }

    // Check if any mode is available
    // DISABLED: QR/Barcode removed from check - was isModeEnabled('face') || isQrOrBarcodeEnabled || isModeEnabled('text')
    const hasAnyMode = isModeEnabled('face') || isModeEnabled('text');

    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        {/* Header */}
        <header className="glass-dark border-b border-[#334155] p-4 safe-area-top">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold gradient-text">FlexVerify Scanner</h1>
              <p className="text-sm text-gray-400">{user?.full_name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          {!hasAnyMode ? (
            <div className="text-center glass rounded-2xl p-8 border border-[#334155]">
              <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">Keine Scanner-Funktionen verfügbar.</p>
              <p className="text-sm text-gray-500 mt-2">Bitte kontaktiere deinen Administrator.</p>
            </div>
          ) : (
            <>
              {isModeEnabled('face') && (
                <button
                  onClick={() => setMode('camera')}
                  className="w-full max-w-sm p-6 bg-gradient-primary rounded-2xl flex flex-col items-center gap-3 transition-all shadow-glow hover:shadow-glow-lg hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Camera className="w-10 h-10 text-white" />
                  </div>
                  <span className="text-lg font-semibold text-white">Foto scannen</span>
                  <span className="text-sm text-white/70">Gesichtserkennung</span>
                </button>
              )}

              {/* DISABLED: QR/Barcode feature temporarily disabled
              {isQrOrBarcodeEnabled && (
                <button
                  onClick={() => setMode('qr')}
                  className="w-full max-w-sm p-6 glass rounded-2xl border border-[#334155] flex flex-col items-center gap-3 transition-all hover:border-primary-500/50 hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="p-3 bg-dark-card rounded-xl border border-[#334155]">
                    <QrCode className="w-10 h-10 text-gray-300" />
                  </div>
                  <span className="text-lg font-semibold text-white">QR/Barcode</span>
                  <span className="text-sm text-gray-400">Code scannen</span>
                </button>
              )}
              */}

              {isModeEnabled('text') && (
                <button
                  onClick={() => setMode('text')}
                  className="w-full max-w-sm p-6 glass rounded-2xl border border-[#334155] flex flex-col items-center gap-3 transition-all hover:border-primary-500/50 hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="p-3 bg-dark-card rounded-xl border border-[#334155]">
                    <Search className="w-10 h-10 text-gray-300" />
                  </div>
                  <span className="text-lg font-semibold text-white">Manuelle Suche</span>
                  <span className="text-sm text-gray-400">Name oder Nummer</span>
                </button>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-gray-500 text-sm safe-area-bottom">
          <a href="/" className="hover:text-primary-400 transition-colors">← Zur Verwaltung</a>
        </footer>
      </div>
    );
  }

  // Camera mode
  if (mode === 'camera') {
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <header className="glass-dark p-4 flex items-center gap-4 border-b border-[#334155] safe-area-top">
          <button onClick={resetScanner} className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">Foto scannen</h1>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-[#334155] shadow-card">
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
              <div className="w-48 h-64 border-2 border-primary-400/40 rounded-full shadow-glow" />
            </div>

            {faceMutation.isPending && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
              </div>
            )}
          </div>

          <button
            onClick={capturePhoto}
            disabled={faceMutation.isPending}
            className="mt-6 w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40" />
          </button>

          {faceMutation.isError && (
            <p className="mt-4 text-danger-400 text-center glass rounded-xl p-3 border border-danger-500/30">
              Fehler bei der Erkennung. Bitte erneut versuchen.
            </p>
          )}
        </main>
      </div>
    );
  }

  // Text search mode
  if (mode === 'text') {
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <header className="glass-dark p-4 flex items-center gap-4 border-b border-[#334155] safe-area-top">
          <button onClick={resetScanner} className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">Manuelle Suche</h1>
        </header>

        <main className="flex-1 p-4">
          <form onSubmit={handleTextSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name oder Personalnummer..."
                className="input flex-1"
                autoFocus
              />
              <button
                type="submit"
                disabled={textMutation.isPending}
                className="btn-primary px-6"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>

          {textMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
            </div>
          )}

          {textMutation.data && (
            <div className="space-y-3">
              {textMutation.data.results.length === 0 ? (
                <div className="text-center glass rounded-xl p-8 border border-[#334155]">
                  <Search className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">Keine Ergebnisse gefunden</p>
                </div>
              ) : (
                textMutation.data.results.map((person: any) => (
                  <button
                    key={person.id}
                    onClick={() => {
                      setResult({
                        match: true,
                        person,
                        confidence: 100,
                        vector_types_tested: 0,
                      });
                      setMode('result');
                    }}
                    className="w-full p-4 glass rounded-xl border border-[#334155] flex items-center gap-4 text-left hover:border-primary-500/50 transition-all active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-full bg-dark-card flex items-center justify-center overflow-hidden border border-[#334155]">
                      {person.photo_url ? (
                        <AuthenticatedImage
                          src={person.photo_url.replace('/api', '')}
                          alt=""
                          className="w-full h-full object-cover"
                          fallbackClassName="w-6 h-6"
                          showLoadingSpinner={false}
                        />
                      ) : (
                        <User className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{person.full_name}</p>
                      <p className="text-sm text-gray-400">{person.personnel_number || person.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  /* DISABLED: QR/Barcode feature temporarily disabled
  // QR mode (placeholder)
  if (mode === 'qr') {
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <header className="glass-dark p-4 flex items-center gap-4 border-b border-[#334155] safe-area-top">
          <button onClick={resetScanner} className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">QR/Barcode Scanner</h1>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-8 border border-[#334155] text-center">
            <QrCode className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">
              QR-Scanner wird geladen...
            </p>
            <p className="text-sm text-gray-500 mt-2">(html5-qrcode Integration)</p>
          </div>
        </main>
      </div>
    );
  }
  */

  // Result screen - Redesigned based on old AEOS design
  if (mode === 'result' && result) {
    const isMatch = result.match && result.person;
    const person = result.person;
    const compliance = result.compliance_status;

    // Helper to get field value from person object
    const getFieldValue = (fieldId: string): string | null => {
      if (!person) return null;
      // Standard fields
      if (fieldId === 'first_name') return person.first_name || null;
      if (fieldId === 'last_name') return person.last_name || null;
      if (fieldId === 'email') return person.email || null;
      if (fieldId === 'phone') return person.phone || null;
      if (fieldId === 'personnel_number') return person.personnel_number || null;
      // Dynamic fields
      if (person.field_data && person.field_data[fieldId]) {
        const value = person.field_data[fieldId];
        // Handle different types
        if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
        if (value instanceof Date) return value.toLocaleDateString('de-DE');
        return String(value);
      }
      return null;
    };

    // No Match View
    if (!isMatch) {
      return (
        <div className="min-h-screen bg-dark-primary flex flex-col">
          <header className="glass-dark p-4 flex items-center gap-4 border-b border-[#334155] safe-area-top">
            <button onClick={resetScanner} className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-6">
            {/* No Match Card */}
            <div className="w-full max-w-md glass rounded-2xl border-l-4 border-l-warning-500 border border-[#334155] overflow-hidden animate-slide-in">
              <div className="p-5 flex items-center gap-3 bg-gradient-to-r from-dark-card to-dark-primary border-b border-[#334155]">
                <span className="text-3xl">🔍</span>
                <h3 className="text-xl font-semibold text-white">Person nicht erkannt</h3>
              </div>
              <div className="p-5">
                <p className="text-gray-300">{result.reason || 'Keine Übereinstimmung gefunden'}</p>
                <div className="mt-4 p-3 bg-warning-500/10 border border-warning-500/30 rounded-lg text-center">
                  <small className="text-warning-400">Versuchen Sie es mit einem besseren Foto oder anderen Winkel</small>
                </div>
              </div>
            </div>

            {/* New Scan Button */}
            <button
              onClick={resetScanner}
              className="mt-8 px-8 py-4 bg-gradient-primary rounded-2xl font-semibold text-white flex items-center gap-2 shadow-glow active:scale-[0.98] transition-transform"
            >
              <RefreshCw className="w-5 h-5" />
              Neuer Scan
            </button>
          </main>
        </div>
      );
    }

    // Match View
    return (
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <header className="glass-dark p-4 flex items-center gap-4 border-b border-[#334155] safe-area-top">
          <button onClick={resetScanner} className="p-2 text-gray-400 hover:text-white hover:bg-dark-card/50 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-8">
          <div className="max-w-md mx-auto space-y-4">
            {/* Result Card */}
            <div className="glass rounded-2xl border-l-4 border-l-success-500 border border-[#334155] overflow-hidden animate-slide-in">
              {/* Header with Icon + Title + Confidence Badge */}
              <div className="p-5 flex items-center gap-3 bg-gradient-to-r from-dark-card to-dark-primary border-b border-[#334155]">
                <span className="text-3xl flex-shrink-0">✅</span>
                <h3 className="text-xl font-semibold text-white flex-1">Person erkannt!</h3>
                {result.confidence && config.face_recognition.show_confidence && (
                  <span className="px-3 py-1 bg-success-500 text-white text-xs font-semibold rounded-full uppercase">
                    {result.confidence.toFixed(2)}% Konfidenz
                  </span>
                )}
              </div>

              <div className="p-5 space-y-5">
                {/* Photo Comparison - Scan vs Profile */}
                {(capturedImage || person.photo_url) && (
                  <div className="flex justify-center gap-4">
                    {/* Captured Photo (Scan) */}
                    {capturedImage && (
                      <div
                        className="cursor-pointer group relative"
                        onClick={() => setLightboxImage({ url: capturedImage, title: 'Aufnahme' })}
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-[#334155] group-hover:border-primary-500 transition-colors">
                          <img
                            src={capturedImage}
                            alt="Aufnahme"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-1.5">Aufnahme</p>
                      </div>
                    )}

                    {/* Profile Photo */}
                    {person.photo_url && (
                      <div
                        className="cursor-pointer group relative"
                        onClick={() => setLightboxImage({
                          url: person.photo_url!.replace('/api', ''),
                          title: 'Mitarbeiterfoto',
                          isAuthenticated: true
                        })}
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden border-[3px] border-primary-500 group-hover:border-primary-400 transition-colors">
                          <AuthenticatedImage
                            src={person.photo_url.replace('/api', '')}
                            alt="Profil"
                            className="w-full h-full object-cover"
                            fallbackClassName="w-10 h-10"
                            showLoadingSpinner={false}
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-xl">
                          <ZoomIn className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-1.5">Mitarbeiter</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Person Name */}
                <div className="text-center">
                  <h4 className="text-xl font-semibold text-white">{person.full_name}</h4>
                  <span className="text-primary-400 font-medium text-sm">ID: {person.id.slice(0, 8)}</span>
                </div>

                {/* Details Grid - filter out fields already shown in header */}
                {person.visible_field_labels && (() => {
                  // Fields already shown in header (full_name = first_name + last_name)
                  const headerFields = ['first_name', 'last_name'];
                  const additionalFields = Object.entries(person.visible_field_labels)
                    .filter(([fieldId]) => !headerFields.includes(fieldId))
                    .filter(([fieldId]) => getFieldValue(fieldId));

                  if (additionalFields.length === 0) return null;

                  return (
                    <div className="bg-dark-elevated rounded-lg border border-[#334155] p-4">
                      {additionalFields.map(([fieldId, label], index, arr) => {
                        const value = getFieldValue(fieldId);
                        return (
                          <div
                            key={fieldId}
                            className={clsx(
                              'flex justify-between items-center py-2',
                              index < arr.length - 1 && 'border-b border-[#334155]'
                            )}
                          >
                            <span className="text-gray-400 font-medium text-sm">{label}:</span>
                            <span className="text-white font-semibold text-sm">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Compliance Status Card */}
                {compliance && (
                  <div className={clsx(
                    'rounded-lg border p-4',
                    compliance.status === 'valid' && 'bg-success-500/10 border-success-500/30',
                    compliance.status === 'warning' && 'bg-warning-500/10 border-warning-500/30',
                    compliance.status === 'expired' && 'bg-danger-500/10 border-danger-500/30',
                    compliance.status === 'pending' && 'bg-gray-500/10 border-gray-500/30'
                  )}>
                    <div className="flex items-center gap-3 mb-2">
                      {compliance.status === 'valid' && <CheckCircle className="w-6 h-6 text-success-400" />}
                      {compliance.status === 'warning' && <AlertTriangle className="w-6 h-6 text-warning-400" />}
                      {compliance.status === 'expired' && <XCircle className="w-6 h-6 text-danger-400" />}
                      {compliance.status === 'pending' && <AlertTriangle className="w-6 h-6 text-gray-400" />}
                      <span className={clsx(
                        'font-semibold',
                        compliance.status === 'valid' && 'text-success-400',
                        compliance.status === 'warning' && 'text-warning-400',
                        compliance.status === 'expired' && 'text-danger-400',
                        compliance.status === 'pending' && 'text-gray-400'
                      )}>
                        {compliance.status === 'valid' && 'Compliance OK'}
                        {compliance.status === 'warning' && 'Warnung'}
                        {compliance.status === 'expired' && 'Abgelaufen'}
                        {compliance.status === 'pending' && 'Ausstehend'}
                      </span>
                    </div>

                    {/* Errors */}
                    {compliance.errors && compliance.errors.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {compliance.errors.map((err, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-danger-400 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-300">{err.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {compliance.warnings && compliance.warnings.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {compliance.warnings.map((warn, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-warning-400 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-300">{warn.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* New Scan Button */}
            <button
              onClick={resetScanner}
              className="w-full py-4 px-6 bg-gradient-primary rounded-2xl font-semibold text-white flex items-center justify-center gap-2 shadow-glow active:scale-[0.98] transition-transform"
            >
              <RefreshCw className="w-5 h-5" />
              Neuer Scan
            </button>
          </div>
        </main>

        {/* Safe area bottom */}
        <div className="safe-area-bottom" />

        {/* Photo Lightbox */}
        {lightboxImage && (
          <PhotoLightbox
            isOpen={!!lightboxImage}
            onClose={() => setLightboxImage(null)}
            imageUrl={lightboxImage.url}
            title={lightboxImage.title}
            isAuthenticated={lightboxImage.isAuthenticated}
          />
        )}
      </div>
    );
  }

  return null;
}
