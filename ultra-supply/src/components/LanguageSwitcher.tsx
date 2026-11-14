import { LOCALES, useI18n } from '@/i18n';

export function LanguageSwitcher({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const light = tone === 'light';
  return (
    <div role="group" aria-label={t('nav.language')} className={`flex items-center ${className}`} dir="ltr">
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center">
          {i > 0 && <span className={`mx-1 h-3 w-px ${light ? 'bg-white/25' : 'bg-navy/15'}`} aria-hidden />}
          <button
            type="button"
            onClick={() => setLocale(l.code)}
            aria-pressed={locale === l.code}
            lang={l.code}
            title={l.name}
            className={`min-h-[36px] min-w-[32px] px-1.5 text-[11.5px] font-semibold tracking-[0.12em] transition-colors ${
              locale === l.code
                ? 'text-brand-red'
                : light ? 'text-white/70 hover:text-white' : 'text-navy/55 hover:text-navy'
            }`}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
