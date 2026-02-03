import { useAuthenticatedImage } from '../../hooks/useAuthenticatedImage';
import { UserCircle } from 'lucide-react';
import clsx from 'clsx';

interface AuthenticatedImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  showLoadingSpinner?: boolean;
}

/**
 * Image component that loads images through authenticated API calls.
 * Shows a placeholder while loading and on error.
 */
export function AuthenticatedImage({
  src,
  alt = '',
  className = '',
  fallbackClassName = '',
  showLoadingSpinner = true,
}: AuthenticatedImageProps) {
  const { blobUrl, isLoading, error } = useAuthenticatedImage(src);

  // Loading state
  if (isLoading && showLoadingSpinner) {
    return (
      <div className={clsx('flex items-center justify-center bg-dark-card', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // Error or no image
  if (!blobUrl || error) {
    return (
      <div className={clsx('flex items-center justify-center bg-dark-card', className)}>
        <UserCircle className={clsx('text-gray-500', fallbackClassName || 'w-12 h-12')} />
      </div>
    );
  }

  // Image loaded
  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
    />
  );
}

export default AuthenticatedImage;
