import { Seo } from '@/components/Seo';
import { Hero } from '@/components/sections/Hero';
import { Intro } from '@/components/sections/Intro';
import { Sectors } from '@/components/sections/Sectors';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { ImportSection } from '@/components/sections/ImportSection';
import { WhySection } from '@/components/sections/WhySection';
import { PartnersSection } from '@/components/sections/PartnersSection';
import { CtaSection } from '@/components/sections/CtaSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { useI18n } from '@/i18n';

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <Seo
        description={t('seo.home.description')}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'ULTRA SUPPLY',
          slogan: 'Agricultural & Industrial Solutions',
          description: t('seo.home.description'),
          areaServed: 'TN',
        }}
      />
      <Hero />
      <Intro />
      <Sectors />
      <FeaturedProducts />
      <ImportSection />
      <WhySection />
      <PartnersSection />
      <CtaSection />
      <ContactSection />
    </>
  );
}
