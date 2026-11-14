import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';
import { PartnerLogo } from '../PartnerLogo';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';

export function PartnersSection({ showLink = true }: { showLink?: boolean }) {
  const { t } = useI18n();
  const { partners } = useCatalog();
  const hasReal = partners.some((p) => p.logo_url);
  return (
    <section aria-labelledby="partners-title" className="bg-mist py-24 sm:py-28">
      <div className="container-site">
        <SectionHeading
          id="partners-title"
          label={t('partners.label')}
          title={t('partners.title')}
          subtitle={hasReal ? undefined : t('partners.subtitle')}
          aside={showLink ? <Link to="/partners" className="btn-link">{t('partners.becomeTitle')} <ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link> : undefined}
        />
        <Reveal className="mt-14 grid grid-cols-2 gap-px border border-navy/10 bg-navy/10 sm:grid-cols-3 lg:grid-cols-6">
          {partners.map((p, i) => <PartnerLogo key={p.id} partner={p} index={i} />)}
        </Reveal>
      </div>
    </section>
  );
}
