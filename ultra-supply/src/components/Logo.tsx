interface Props {
  variant?: 'dark' | 'light';
  withTagline?: boolean;
  className?: string;
}

/** ULTRA SUPPLY mark: a machined "U" profile with a red cut. */
export function LogoMark({ className = 'h-10 w-10', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" fill={light ? '#FFFFFF' : '#123B70'} />
      <path d="M12 9v17.5a12 12 0 0 0 24 0V9h-6.5v17.5a5.5 5.5 0 0 1-11 0V9z" fill={light ? '#123B70' : '#FFFFFF'} />
      <path d="M29.5 9H36l-5 8.5h-6.5z" fill="#D92332" />
    </svg>
  );
}

export function Logo({ variant = 'dark', withTagline = true, className = '' }: Props) {
  const light = variant === 'light';
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} dir="ltr">
      <LogoMark light={light} className="h-10 w-10 shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={`font-['Archivo'] text-[19px] font-extrabold uppercase tracking-[0.04em] ${light ? 'text-white' : 'text-navy'}`}
          style={{ fontStretch: '115%' }}
        >
          Ultra <span className="text-brand-red">Supply</span>
        </span>
        {withTagline && (
          <span className={`mt-1.5 text-[8.5px] font-semibold uppercase tracking-[0.24em] ${light ? 'text-white/60' : 'text-navy/55'}`}>
            Agricultural &amp; Industrial Solutions
          </span>
        )}
      </span>
    </span>
  );
}
