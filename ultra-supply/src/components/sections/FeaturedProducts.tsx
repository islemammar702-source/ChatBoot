import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';
import { ProductCard } from '../ProductCard';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';

export function FeaturedProducts() {
  const { t } = useI18n();
  const { products, categories } = useCatalog();
  const featured = (products.filter((p) => p.featured).length ? products.filter((p) => p.featured) : products).slice(0, 6);
  return (
    <section aria-labelledby="products-title" className="py-24 sm:py-32">
      <div className="container-site">
        <SectionHeading
          id="products-title"
          label={t('products.label')}
          title={t('products.title')}
          subtitle={t('products.subtitle')}
          aside={
            <Link to="/products" className="btn btn-ghost">
              {t('common.viewAll')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          }
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 100}>
              <ProductCard product={p} category={categories.find((c) => c.id === p.category_id)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
