import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

interface Props {
  label: string;
  title: string;
  subtitle?: string;
  align?: 'start' | 'center';
  tone?: 'dark' | 'light';
  aside?: ReactNode;
  id?: string;
}

export function SectionHeading({ label, title, subtitle, align = 'start', tone = 'dark', aside, id }: Props) {
  const light = tone === 'light';
  return (
    <Reveal
      className={`flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between ${align === 'center' ? 'items-center text-center lg:flex-col lg:items-center' : ''}`}
    >
      <div className={align === 'center' ? 'max-w-3xl' : 'max-w-4xl'}>
        <span className="eyebrow">{label}</span>
        <h2 id={id} className={`display-lg mt-5 ${light ? 'text-white' : 'text-navy'}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`mt-5 max-w-2xl text-[17px] leading-relaxed ${light ? 'text-white/70' : 'text-navy-950/65'} ${align === 'center' ? 'mx-auto' : ''}`}>
            {subtitle}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </Reveal>
  );
}
