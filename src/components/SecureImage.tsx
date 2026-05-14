import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { Loader2 } from 'lucide-react';

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  url: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({ url, className, ...props }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        // Ensure we have a session (Anonymous or Real)
        const user = auth.currentUser;
        if (!user) {
          // If no user, we might be waiting for auth to initialize
          // Return early and let the next auth change trigger a re-render
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch image');

        const blob = await response.blob();
        if (isMounted) {
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('SecureImage error:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-black/5 animate-pulse ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-brand-gold/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-rose-50 text-rose-200 ${className}`}>
        <span className="text-[8px] font-bold uppercase">Load Error</span>
      </div>
    );
  }

  return <img src={src} className={className} {...props} />;
};
