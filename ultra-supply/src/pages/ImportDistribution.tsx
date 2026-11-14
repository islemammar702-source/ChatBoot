import { Link } from 'react-router-dom';
import { ArrowRight, PackageSearch } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { SectionHeading } from '@/components/SectionHeading';
import { useImportSteps } from '@/components/sections/ImportSection';
import { CtaSection } from '@/components/sections/CtaSection';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export default function ImportDistribution() {
  const { t } = useI18n();
  const steps = useImportSteps();
  return (
    <>
      <Seo title={t('nav.import')} description={t('seo.import.description')} />
      <PageHero label={t('import.label')} title={t('import.title')} intro={t('import.description')} image={images.logistics} crumbs={[{ label: t('nav.import') }]} />

      <section className="py-24 sm:py-32" aria-labelledby="process-title">
        <div className="container-site">
          <SectionHeading id="process-title" label={t('import.label')} title={t('import.processTitle')} subtitle={t('import.pageIntro')} />
          <ol className="mt-16 space-y-6">
            {steps.map(({ Icon, title, text, image }, i) => (
              <Reveal as="li" key={title} className="group grid overflow-hidden border border-navy/10 bg-white md:grid-cols-12">
                <div className="relative md:col-span-5">
                  <Img src={image} alt={title} className="h-full min-h-[240px] w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                  <span className="absolute start-0 top-0 bg-brand-red px-5 py-3 font-display text-2xl font-black text-white" dir="ltr">0{i + 1}</span>
                </div>
                <div className="flex flex-col justify-center p-8 sm:p-12 md:col-span-7">
                  <Icon className="h-10 w-10 text-navy" strokeWidth={1.1} />
                  <h3 className="display-md mt-6 text-navy">{title}</h3>
                  <p className="mt-4 max-w-xl text-[17px] text-navy-950/70">{text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-mist py-24 sm:py-28">
        <div className="container-site grid gap-6 lg:grid-cols-2">
          <Reveal className="relative overflow-hidden bg-navy p-10 text-white sm:p-14">
            <PackageSearch className="h-10 w-10 text-brand-red" strokeWidth={1.2} />
            <h2 className="display-md mt-8">{t('import.whatTitle')}</h2>
            <p className="mt-5 text-[17px] text-white/75">{t('import.whatText')}</p>
            <Link to="/products" className="btn btn-ghost-light mt-10">{t('nav.products')} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
          </Reveal>
          <Reveal delay={120} className="relative isolate overflow-hidden p-10 text-white sm:p-14">
            <Img src={images.warehouse} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-navy-950/80" />
            <span className="block h-[3px] w-10 bg-brand-red" />
            <h2 className="display-md mt-8">{t('import.suppliersTitle')}</h2>
            <p className="mt-5 text-[17px] text-white/75">{t('import.suppliersText')}</p>
            <Link to="/contact" className="btn btn-red mt-10">{t('import.suppliersCta')} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
          </Reveal>
        </div>
      </section>
      <CtaSection />
    </>
  );
}
