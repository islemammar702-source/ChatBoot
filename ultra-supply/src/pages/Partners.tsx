import { Link } from 'react-router-dom';
import { ArrowRight, Handshake } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { PartnersSection } from '@/components/sections/PartnersSection';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export default function Partners() {
  const { t } = useI18n();
  return (
    <>
      <Seo title={t('nav.partners')} description={t('seo.partners.description')} />
      <PageHero label={t('partners.label')} title={t('partners.title')} intro={t('partners.pageIntro')} image={images.sourcing} crumbs={[{ label: t('nav.partners') }]} />
      <PartnersSection showLink={false} />
      <section className="py-24 sm:py-28">
        <div className="container-site">
          <Reveal className="grid items-center gap-10 border border-navy/10 p-8 sm:p-14 lg:grid-cols-12">
            <div className="lg:col-span-1">
              <span className="flex h-16 w-16 items-center justify-center bg-brand-red text-white"><Handshake className="h-8 w-8" strokeWidth={1.2} /></span>
            </div>
            <div className="lg:col-span-8">
              <h2 className="display-md text-navy">{t('partners.becomeTitle')}</h2>
              <p className="mt-4 max-w-2xl text-[17px] text-navy-950/70">{t('partners.becomeText')}</p>
            </div>
            <div className="lg:col-span-3 lg:text-end">
              <Link to="/contact" className="btn btn-navy">{t('import.suppliersCta')} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
