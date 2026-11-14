import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { ProductCard } from '@/components/ProductCard';
import { CtaSection } from '@/components/sections/CtaSection';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';
import { images } from '@/data/images';
import type { Product } from '@/lib/types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Products() {
  const { t, loc } = useI18n();
  const { products, categories, loading } = useCatalog();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = params.get('sort') ?? 'featured';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const activeCat = categories.find((c) => c.slug === category);

  const filtered = useMemo(() => {
    const needle = norm(q.trim());
    const match = (p: Product) => {
      if (activeCat && p.category_id !== activeCat.id) return false;
      if (!needle) return true;
      const cat = categories.find((c) => c.id === p.category_id);
      const hay = norm([
        p.reference, ...Object.values(p.name), ...Object.values(p.description),
        ...(cat ? Object.values(cat.name) : []),
      ].join(' '));
      return needle.split(/\s+/).every((w) => hay.includes(w));
    };
    const list = products.filter(match);
    return sort === 'name'
      ? [...list].sort((a, b) => loc(a.name).localeCompare(loc(b.name)))
      : [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [products, categories, activeCat, q, sort, loc]);

  return (
    <>
      <Seo title={t('products.pageTitle')} description={t('seo.products.description')} />
      <PageHero
        label={t('products.label')}
        title={activeCat ? loc(activeCat.name) : t('products.pageTitle')}
        intro={activeCat ? loc(activeCat.description) : t('products.pageIntro')}
        image={activeCat?.image_url ?? images.warehouse}
        crumbs={activeCat ? [{ label: t('nav.products'), to: '/products' }, { label: loc(activeCat.name) }] : [{ label: t('nav.products') }]}
      />

      <section className="py-16 sm:py-20" aria-label={t('products.pageTitle')}>
        <div className="container-site">
          {/* Toolbar */}
          <div className="z-30 -mx-4 lg:sticky lg:top-[72px] border-b border-navy/10 bg-white/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <span className="sr-only">{t('products.search')}</span>
                <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => update('q', e.target.value)}
                  placeholder={t('products.search')}
                  className="field !ps-11"
                />
              </label>
              <div className="flex gap-3">
                <label className="relative flex-1 lg:w-64 lg:flex-none">
                  <span className="sr-only">{t('common.category')}</span>
                  <select value={category} onChange={(e) => update('category', e.target.value)} className="field appearance-none !pe-10">
                    <option value="">{t('products.allCategories')}</option>
                    {categories.map((c) => <option key={c.id} value={c.slug}>{loc(c.name)}</option>)}
                  </select>
                  <SlidersHorizontal className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
                </label>
                <label className="relative">
                  <span className="sr-only">{t('products.sort')}</span>
                  <select value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)} className="field appearance-none">
                    <option value="featured">{t('products.sortFeatured')}</option>
                    <option value="name">{t('products.sortName')}</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="list">
              <button type="button" role="listitem" onClick={() => update('category', '')}
                className={`min-h-[36px] shrink-0 whitespace-nowrap px-4 text-[12px] font-semibold transition-colors ${!category ? 'bg-navy text-white' : 'bg-mist text-navy hover:bg-navy-100'}`}>
                {t('products.allCategories')}
              </button>
              {categories.map((c) => (
                <button key={c.id} type="button" role="listitem" onClick={() => update('category', c.slug)} aria-pressed={category === c.slug}
                  className={`min-h-[36px] shrink-0 whitespace-nowrap px-4 text-[12px] font-semibold transition-colors ${category === c.slug ? 'bg-navy text-white' : 'bg-mist text-navy hover:bg-navy-100'}`}>
                  {loc(c.name)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between text-[13px] text-navy/60">
            <p aria-live="polite">{t('products.results', { count: filtered.length })}</p>
            <p className="font-semibold uppercase tracking-[0.14em] text-brand-red rtl:tracking-normal">{t('products.priceOnRequest')}</p>
          </div>

          {loading ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse bg-mist" />)}
            </div>
          ) : filtered.length ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => <ProductCard key={p.id} product={p} category={categories.find((c) => c.id === p.category_id)} />)}
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center border border-dashed border-navy/20 px-6 py-20 text-center">
              <Search className="h-10 w-10 text-navy/25" strokeWidth={1} />
              <p className="mt-6 text-[17px] text-navy">{t('products.empty')}</p>
              <button type="button" onClick={() => setParams({}, { replace: true })} className="btn btn-ghost mt-8">
                <X className="h-4 w-4" /> {t('products.reset')}
              </button>
            </div>
          )}
        </div>
      </section>
      <CtaSection />
    </>
  );
}
