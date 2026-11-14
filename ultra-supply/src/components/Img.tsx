import { useState, type ImgHTMLAttributes } from 'react';
import { ImageOff } from 'lucide-react';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  /** Eager-load above-the-fold images. */
  priority?: boolean;
}

/**
 * Image with lazy loading and a branded fallback when the source is missing
 * or fails to load (e.g. until the company's own photographs are added).
 */
export function Img({ src, alt, priority, className = '', ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-700 via-navy to-navy-950 ${className}`}
      >
        <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(135deg,#fff_0_1px,transparent_1px_14px)]" />
        <ImageOff className="relative h-8 w-8 text-white/50" strokeWidth={1.25} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // @ts-expect-error — fetchpriority is a valid HTML attribute not yet in React 18 types
      fetchpriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
