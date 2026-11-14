import { useI18n } from '@/i18n';
import type { Partner } from '@/lib/types';

/** Shows a partner logo, or a neutral placeholder slot until a real logo is uploaded. */
export function PartnerLogo({ partner, index }: { partner: Partner; index: number }) {
  const { t } = useI18n();
  const inner = partner.logo_url ? (
    <img src={partner.logo_url} alt={partner.name} loading="lazy" className="max-h-14 max-w-[70%] object-contain opacity-70 grayscale transition-all duration-500 group-hover:opacity-100 group-hover:grayscale-0" />
  ) : (
    <span className="flex flex-col items-center gap-3 text-navy/30 transition-colors duration-500 group-hover:text-navy/60">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <rect x="1" y="1" width="38" height="38" fill="none" stroke="currentColor" strokeDasharray="3 3" />
        <path d="M12 26 20 13l8 13z" fill="currentColor" opacity=".5" />
      </svg>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] rtl:text-[12px] rtl:tracking-normal">
        {t('partners.slot')} <span dir="ltr">{String(index + 1).padStart(2, '0')}</span>
      </span>
    </span>
  );
  const cls = 'group flex aspect-[3/2] items-center justify-center bg-white transition-colors duration-500 hover:bg-mist';
  return partner.website ? (
    <a href={partner.website} target="_blank" rel="noopener noreferrer" className={cls} aria-label={partner.name}>{inner}</a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
