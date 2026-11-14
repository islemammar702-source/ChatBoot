interface Props {
  /** "dark" = navy/red logo for light backgrounds, "light" = white/red logo for dark backgrounds. */
  variant?: 'dark' | 'light';
  /** Full version includes the "Équipements agricoles • Électricité automobile • Outillage" line. */
  full?: boolean;
  className?: string;
}

/** Official ULTRA SUPPLY logo (source file: design/ultra-supply-logo-original.jpg). */
export function Logo({ variant = 'dark', full = false, className = '' }: Props) {
  const light = variant === 'light';
  const file = `${full ? 'logo-full' : 'logo'}${light ? '-light' : ''}.webp`;
  const [w, h] = full ? [720, 259] : [640, 200];
  return (
    <img
      src={`/brand/${file}`}
      alt="ULTRA SUPPLY"
      width={w}
      height={h}
      decoding="async"
      className={`block w-auto select-none ${full ? 'h-20' : 'h-11 sm:h-12 lg:h-14'} ${className}`}
      draggable={false}
    />
  );
}
