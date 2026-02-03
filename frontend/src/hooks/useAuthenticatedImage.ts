import { useState, useEffect } from 'react';
import { fetchAuthenticatedImage } from '../services/api';

/**
 * Hook to load an image through an authenticated API call.
 * Returns a blob URL that can be used in <img> src.
 */
export function useAuthenticatedImage(imageUrl: string | null | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setBlobUrl(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchAuthenticatedImage(imageUrl)
      .then((url) => {
        if (isMounted) {
          setBlobUrl(url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    // Cleanup: revoke blob URL when component unmounts or URL changes
    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [imageUrl]);

  return { blobUrl, isLoading, error };
}

export default useAuthenticatedImage;
