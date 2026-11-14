import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Img } from './Img';
import { useI18n } from '@/i18n';

interface Props {
  label: string;
  title: string;
  intro?: string;
  image?: string;
  crumbs?: { label: string; to?: string }[];
}

/** Editorial banner used at the top of inner pages. */
export function PageHero({ label, title, intro, image, crumbs = [] }: Props) {
  const { t } = useI18n();
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 pb-16 pt-40 text-white sm:pb-20 sm:pt-48 lg:pb-28">
      {image && (
        <Img src={image} alt="" priority className="absolute inset-0 -z-20 h-full w-full animate-kenburns object-cover opacity-45" />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy/40 rtl:bg-gradient-to-l" />
      <div className="grain absolute inset-0 -z-10" />
      <div className="container-site">
        <nav aria-label="Breadcrumb" className="mb-10 text-[12px] text-white/55">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link to="/" className="hover:text-white">{t('nav.home')}</Link></li>
            {crumbs.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                {c.to ? <Link to={c.to} className="hover:text-white">{c.label}</Link> : <span aria-current="page" className="text-white/85">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        <span className="eyebrow">{label}</span>
        <h1 className="display-lg mt-5 max-w-5xl">{title}</h1>
        {intro && <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-white/70">{intro}</p>}
      </div>
    </section>
  );
}
