import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { ContactSection } from '@/components/sections/ContactSection';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export default function Contact() {
  const { t } = useI18n();
  return (
    <>
      <Seo title={t('nav.contact')} description={t('seo.contact.description')} />
      <PageHero label={t('contact.label')} title={t('contact.title')} intro={t('contact.subtitle')} image={images.contact} crumbs={[{ label: t('nav.contact') }]} />
      <ContactSection heading={false} />
    </>
  );
}
