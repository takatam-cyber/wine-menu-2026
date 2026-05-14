import React, { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { Loader2, AlertCircle } from 'lucide-react';

interface AuthImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string;
}

export const AuthImage: React.FC<AuthImageProps> = ({ url, className, ...props }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // Wait for auth to be ready if needed
        const currentUser = auth.currentUser;
        if (!currentUser) {
          // If not auth yet, we might want to wait or try without
          // But since the route requires auth, we need a token
          setLoading(false);
          return;
        }

        const token = await currentUser.getIdToken();
        const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        
        const response = await fetch(proxiedUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch image');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (err) {
        console.error('AuthImage error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchImage();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 animate-pulse ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <AlertCircle className="w-6 h-6 opacity-20" />
      </div>
    );
  }

  return <img src={src} className={className} {...props} />;
};
