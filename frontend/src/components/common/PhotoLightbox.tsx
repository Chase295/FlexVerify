import { useEffect, useCallback } from 'react';
import { X, UserCircle } from 'lucide-react';
import { useAuthenticatedImage } from '../../hooks/useAuthenticatedImage';

interface PhotoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  isAuthenticated?: boolean;
}

export default function PhotoLightbox({
  isOpen,
  onClose,
  imageUrl,
  title,
  isAuthenticated = false,
}: PhotoLightboxProps) {
  // ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4 px-2">
          {title && (
            <p className="text-white/80 text-sm font-medium">{title}</p>
          )}
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-auto"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Image */}
        {isAuthenticated ? (
          <AuthenticatedLightboxImage src={imageUrl} alt={title || 'Photo'} />
        ) : (
          <img
            src={imageUrl}
            alt={title || 'Photo'}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

// Separate component for authenticated images in lightbox
function AuthenticatedLightboxImage({ src, alt }: { src: string; alt: string }) {
  const { blobUrl, isLoading, error } = useAuthenticatedImage(src);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center bg-dark-card/50 rounded-lg min-w-[200px] min-h-[200px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // Error or no image
  if (!blobUrl || error) {
    return (
      <div className="flex items-center justify-center bg-dark-card/50 rounded-lg min-w-[200px] min-h-[200px]">
        <UserCircle className="w-16 h-16 text-gray-500" />
      </div>
    );
  }

  // Image loaded
  return (
    <img
      src={blobUrl}
      alt={alt}
      className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
    />
  );
}
