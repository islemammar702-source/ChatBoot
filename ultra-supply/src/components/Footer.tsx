import { Link } from 'react-router-dom';
import { ArrowUp, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { Logo } from './Logo';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';
import { NAV } from '@/lib/routes';
import type { DictKey } from '@/i18n/fr';

const SOCIALS: { key: DictKey; label: string; Icon: typeof Facebook }[] = [
  { key: 'social.facebook', label: 'Facebook', Icon: Facebook },
  { key: 'social.linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'social.instagram', label: 'Instagram', Icon: Instagram },
  { key: 'social.youtube', label: 'YouTube', Icon: Youtube },
];

export function Footer() {
  const { t, loc } = useI18n();
  const { categories } = useCatalog();

  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute -end-32 -top-40 select-none font-display text-[22rem] font-black uppercase leading-none text-white/[0.025]" aria-hidden dir="ltr">
        US
      </div>
      <div className="container-site relative pb-10 pt-20 lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo variant="light" />
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-white/60">{t('footer.description')}</p>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{t('footer.follow')}</p>
            <ul className="mt-3 flex gap-2">
              {SOCIALS.map(({ key, label, Icon }) => {
                const href = t(key);
                const cls = 'flex h-11 w-11 items-center justify-center border border-white/15 transition-colors';
                return (
                  <li key={key}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`${cls} hover:border-brand-red hover:bg-brand-red`}>
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                      </a>
                    ) : (
                      <span title={`${label} — ${t('common.placeholder')}`} aria-label={`${label} — ${t('common.placeholder')}`} className={`${cls} text-white/40`}>
                        <Icon className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <nav aria-label={t('footer.navigation')} className="lg:col-span-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-red">{t('footer.navigation')}</h2>
            <ul className="mt-6 space-y-3 text-[14.5px]">
              {[...NAV, { to: '/quote', key: 'nav.quote' as DictKey }].map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="text-white/70 transition-colors hover:text-white">{t(n.key)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('footer.categories')} className="lg:col-span-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-red">{t('footer.categories')}</h2>
            <ul className="mt-6 space-y-3 text-[14.5px]">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/products?category=${c.slug}`} className="text-white/70 transition-colors hover:text-white">{loc(c.name)}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-red">{t('footer.contact')}</h2>
            <ul className="mt-6 space-y-4 text-[14.5px] text-white/70">
              <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/40" /><span dir="ltr">{t('contact.phoneValue')}</span></li>
              <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/40" /><span className="break-all">{t('contact.emailValue')}</span></li>
              <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" /><span>{t('contact.addressValue')}</span></li>
            </ul>
            <Link to="/quote" className="btn btn-red mt-8">{t('nav.quote')}</Link>
          </div>
        </div>

        <div className="mt-20 flex flex-col-reverse items-start justify-between gap-6 border-t border-white/10 pt-8 text-[13px] text-white/45 sm:flex-row sm:items-center">
          <p>{t('footer.copyright')}</p>
          <div className="flex items-center gap-6">
            <Link to="/admin" className="hover:text-white">{t('footer.admin')}</Link>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-h-[44px] items-center gap-2 hover:text-white">
              {t('footer.top')} <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
