import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { CtaSection } from '@/components/sections/CtaSection';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';
import { iconFor } from '@/data/sectors';
import { images } from '@/data/images';

export default function Industries() {
  const { t, loc } = useI18n();
  const { categories, products } = useCatalog();
  return (
    <>
      <Seo title={t('industries.pageTitle')} description={t('seo.industries.description')} />
      <PageHero label={t('sectors.label')} title={t('industries.pageTitle')} intro={t('industries.pageIntro')} image={images.field} crumbs={[{ label: t('nav.industries') }]} />

      <div className="py-12 sm:py-20">
        {categories.map((c, i) => {
          const Icon = iconFor(c.slug);
          const items = products.filter((p) => p.category_id === c.id);
          const reverse = i % 2 === 1;
          return (
            <section key={c.id} id={c.slug} aria-labelledby={`sector-${c.slug}`} className="scroll-mt-28 py-12 sm:py-16">
              <div className="container-site grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
                <Reveal className={`relative lg:col-span-7 ${reverse ? 'lg:order-2' : ''}`}>
                  <Img src={c.image_url} alt={loc(c.name)} className="aspect-[16/10] w-full object-cover" />
                  <span className={`absolute -bottom-6 ${reverse ? 'start-6' : 'end-6'} flex h-20 w-20 items-center justify-center bg-brand-red text-white shadow-xl`}>
                    <Icon className="h-8 w-8" strokeWidth={1.25} />
                  </span>
                </Reveal>
                <Reveal delay={120} className="lg:col-span-5">
                  <span className="font-display text-sm font-bold tracking-[0.2em] text-brand-red" dir="ltr">{String(i + 1).padStart(2, '0')} / {String(categories.length).padStart(2, '0')}</span>
                  <h2 id={`sector-${c.slug}`} className="display-md mt-4 text-navy">{loc(c.name)}</h2>
                  <p className="mt-5 text-[17px] text-navy-950/70">{loc(c.description)}</p>
                  {items.length > 0 && (
                    <ul className="mt-8 divide-y divide-navy/10 border-y border-navy/10">
                      {items.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <Link to={`/products/${p.slug}`} className="group flex items-center justify-between py-3.5 text-[15px] text-navy hover:text-brand-red">
                            {loc(p.name)}
                            <ArrowRight className="h-4 w-4 opacity-40 transition-all group-hover:translate-x-1 group-hover:opacity-100 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link to={`/products?category=${c.slug}`} className="btn btn-navy">{t('industries.viewProducts')}</Link>
                    <Link to="/quote" className="btn btn-ghost">{t('common.requestQuote')}</Link>
                  </div>
                </Reveal>
              </div>
            </section>
          );
        })}
      </div>
      <CtaSection />
    </>
  );
}
