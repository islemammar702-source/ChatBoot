import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronRight, Info, MessageSquare } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Img } from '@/components/Img';
import { ProductCard } from '@/components/ProductCard';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import NotFound from './NotFound';

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const { t, loc } = useI18n();
  const { products, categories, loading: catalogLoading } = useCatalog();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    const cached = products.find((p) => p.slug === slug);
    if (cached) {
      setProduct(cached);
      return;
    }
    if (catalogLoading) return;
    let alive = true;
    api.getProduct(slug).then((p) => alive && setProduct(p)).catch(() => alive && setProduct(null));
    return () => {
      alive = false;
    };
  }, [slug, products, catalogLoading]);

  if (product === undefined) {
    return <div className="container-site min-h-[70vh] pt-40"><div className="h-96 animate-pulse bg-mist" /></div>;
  }
  if (!product) return <NotFound message={t('products.notFound')} />;

  const category = categories.find((c) => c.id === product.category_id);
  const name = loc(product.name);
  const related = products.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 3);
  const fallbackRelated = related.length ? related : products.filter((p) => p.id !== product.id).slice(0, 3);

  return (
    <>
      <Seo
        title={name}
        description={loc(product.description)}
        image={product.image_url}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          sku: product.reference,
          description: loc(product.description),
          image: product.image_url ?? undefined,
          category: category ? loc(category.name) : undefined,
          brand: { '@type': 'Organization', name: 'ULTRA SUPPLY' },
        }}
      />
      <section className="pb-20 pt-32 sm:pt-36">
        <div className="container-site">
          <nav aria-label="Breadcrumb" className="mb-10 text-[12px] text-navy/55">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link to="/" className="hover:text-navy">{t('nav.home')}</Link></li>
              <li className="flex items-center gap-2"><ChevronRight className="h-3 w-3 rtl:rotate-180" /><Link to="/products" className="hover:text-navy">{t('nav.products')}</Link></li>
              {category && (
                <li className="flex items-center gap-2"><ChevronRight className="h-3 w-3 rtl:rotate-180" /><Link to={`/products?category=${category.slug}`} className="hover:text-navy">{loc(category.name)}</Link></li>
              )}
              <li className="flex items-center gap-2"><ChevronRight className="h-3 w-3 rtl:rotate-180" /><span aria-current="page" className="text-navy">{name}</span></li>
            </ol>
          </nav>

          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="relative overflow-hidden bg-mist">
                <Img src={product.image_url} alt={name} priority className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-4 start-4 bg-white/90 px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-navy/60 rtl:normal-case rtl:tracking-normal">
                  {t('common.photoPlaceholder')}
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              {category && <span className="eyebrow">{loc(category.name)}</span>}
              <h1 className="display-lg mt-5 text-navy">{name}</h1>
              <p className="mt-5 text-[12px] uppercase tracking-[0.16em] text-navy/50" dir="ltr" style={{ textAlign: 'start' }}>
                {t('common.reference')} · <span className="font-mono tracking-normal text-navy">{product.reference}</span>
              </p>
              <p className="mt-8 text-[17px] leading-relaxed text-navy-950/70">{loc(product.description)}</p>

              {product.specs.length > 0 && (
                <div className="mt-10">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-navy rtl:text-[13px] rtl:normal-case rtl:tracking-normal">{t('products.specs')}</h2>
                  <dl className="mt-4 divide-y divide-navy/10 border-y border-navy/10">
                    {product.specs.map((s, i) => (
                      <div key={i} className="grid grid-cols-2 gap-4 py-3.5 text-[14.5px]">
                        <dt className="text-navy/55">{loc(s.label)}</dt>
                        <dd className="font-medium text-navy">{loc(s.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="mt-8 flex items-center gap-3 bg-mist p-4 text-[13px] text-navy/70">
                <Info className="h-4 w-4 shrink-0 text-navy" /> {t('products.detailNote')}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={`/quote?product=${product.slug}`} className="btn btn-red flex-1">
                  {t('common.requestQuote')} <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
                <Link to="/contact" className="btn btn-ghost flex-1">
                  <MessageSquare className="h-4 w-4" /> {t('nav.contact')}
                </Link>
              </div>
              <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-red rtl:tracking-normal">{t('products.priceOnRequest')}</p>
            </div>
          </div>

          <Link to="/products" className="btn-link mt-16">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('common.back')}
          </Link>
        </div>
      </section>

      {fallbackRelated.length > 0 && (
        <section className="bg-mist py-20 sm:py-24" aria-labelledby="related-title">
          <div className="container-site">
            <h2 id="related-title" className="display-md text-navy">{t('products.related')}</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {fallbackRelated.map((p) => <ProductCard key={p.id} product={p} category={categories.find((c) => c.id === p.category_id)} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
