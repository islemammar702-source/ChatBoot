import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Img } from './Img';
import { useI18n } from '@/i18n';
import type { Category, Product } from '@/lib/types';

interface Props {
  product: Product;
  category?: Category;
}

export function ProductCard({ product, category }: Props) {
  const { t, loc } = useI18n();
  const name = loc(product.name);
  return (
    <article className="group flex h-full flex-col border border-navy/10 bg-white transition-all duration-500 hover:-translate-y-1 hover:border-navy/25 hover:shadow-[0_30px_60px_-35px_rgba(10,36,69,0.45)]">
      <Link to={`/products/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-mist" tabIndex={-1} aria-hidden>
        <Img src={product.image_url} alt={name} className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105" />
        {category && (
          <span className="absolute start-4 top-4 bg-white px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-navy rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
            {loc(category.name)}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-navy/45" dir="ltr">
          <span className="rtl:hidden">{t('common.reference')} · </span>
          <span className="font-mono tracking-normal">{product.reference}</span>
        </p>
        <h3 className="mt-2 font-display text-[21px] font-bold uppercase leading-tight text-navy rtl:normal-case">
          <Link to={`/products/${product.slug}`} className="transition-colors hover:text-brand-red">{name}</Link>
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-[14.5px] text-navy-950/65">{loc(product.description)}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link to={`/products/${product.slug}`} className="btn btn-ghost !min-h-[44px] !whitespace-normal !px-3 !text-[11px] rtl:!text-[13px]">
            {t('common.viewDetails')}
          </Link>
          <Link to={`/quote?product=${product.slug}`} className="btn btn-red !min-h-[44px] !whitespace-normal !px-3 !text-[11px] rtl:!text-[13px]">
            <FileText className="hidden h-3.5 w-3.5 sm:block" />
            {t('common.requestQuote')}
          </Link>
        </div>
      </div>
    </article>
  );
}
