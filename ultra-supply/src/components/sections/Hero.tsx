import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Img } from '../Img';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export function Hero() {
  const { t } = useI18n();
  const tags = [t('hero.tag1'), t('hero.tag2'), t('hero.tag3'), t('hero.tag4')];
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-navy-950 text-white">
      <Img src={images.hero} alt={t('hero.label')} priority className="absolute inset-0 -z-30 h-full w-full animate-kenburns object-cover" />
      <div className="absolute inset-0 -z-20 bg-gradient-to-r from-navy-950/95 via-navy/75 to-navy/25 rtl:bg-gradient-to-l" />
      <div className="absolute inset-0 -z-20 bg-gradient-to-t from-navy-950/90 via-transparent to-navy-950/50" />
      <div className="grain absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-0 -z-10 hidden opacity-60 lg:block">
        <div className="container-site grid h-full grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="border-s border-white/[0.06]" />)}
        </div>
      </div>

      <div className="container-site flex flex-1 flex-col justify-center pb-36 pt-32 sm:pt-40">
        <div className="max-w-5xl">
          <p className="eyebrow">{t('hero.label')}</p>
          <h1 id="hero-title" className="display-xl brand-latin mt-7">
            <span className="block">Ultra</span>
            <span className="block">
              Supply<span className="text-brand-red">.</span>
            </span>
          </h1>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div className="max-w-2xl border-s-2 border-brand-red ps-6">
              <p className="font-display text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold leading-snug text-white">{t('hero.subtitle')}</p>
              <p className="mt-4 text-[16px] leading-relaxed text-white/70">{t('hero.description')}</p>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/products" className="btn btn-red">
              {t('hero.ctaProducts')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <Link to="/quote" className="btn btn-ghost-light">
              {t('hero.ctaQuote')} <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-navy-950/40 backdrop-blur-sm">
        <div className="container-site flex items-center justify-between gap-6 py-5">
          <ul className="hidden flex-wrap items-center gap-x-8 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 md:flex rtl:text-[13px] rtl:normal-case rtl:tracking-normal">
            {tags.map((tag, i) => (
              <li key={tag} className="flex items-center gap-3">
                <span className="text-brand-red" dir="ltr">0{i + 1}</span> {tag}
              </li>
            ))}
          </ul>
          <a href="#intro" className="group flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white rtl:tracking-normal">
            <span className="relative flex h-10 w-6 justify-center rounded-full border border-white/40 pt-2">
              <span className="h-2 w-[2px] animate-scrollDot rounded-full bg-white" />
            </span>
            {t('hero.scroll')}
          </a>
        </div>
      </div>
    </section>
  );
}
