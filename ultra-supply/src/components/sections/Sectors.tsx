import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';
import { SectorCard } from '../SectorCard';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';

/** Asymmetric editorial grid: 7/5 · 5/7 · 6/6 */
const SPANS = ['lg:col-span-7', 'lg:col-span-5', 'lg:col-span-5', 'lg:col-span-7', 'lg:col-span-6', 'lg:col-span-6'];

export function Sectors() {
  const { t } = useI18n();
  const { categories } = useCatalog();
  return (
    <section aria-labelledby="sectors-title" className="bg-mist py-24 sm:py-32">
      <div className="container-site">
        <SectionHeading
          id="sectors-title"
          label={t('sectors.label')}
          title={t('sectors.title')}
          subtitle={t('sectors.subtitle')}
          aside={
            <Link to="/industries" className="btn-link">
              {t('nav.industries')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          }
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {categories.slice(0, 6).map((c, i) => (
            <Reveal key={c.id} delay={(i % 2) * 120} className={SPANS[i] ?? 'lg:col-span-6'}>
              <SectorCard category={c} index={i} className="h-full" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
