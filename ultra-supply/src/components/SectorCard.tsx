import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Img } from './Img';
import { useI18n } from '@/i18n';
import { iconFor } from '@/data/sectors';
import type { Category } from '@/lib/types';

interface Props {
  category: Category;
  index: number;
  className?: string;
}

export function SectorCard({ category, index, className = '' }: Props) {
  const { t, loc } = useI18n();
  const Icon = iconFor(category.slug);
  const title = loc(category.name);
  return (
    <Link
      to={`/products?category=${category.slug}`}
      className={`group relative isolate flex min-h-[380px] flex-col justify-end overflow-hidden bg-navy-950 text-white sm:min-h-[440px] ${className}`}
    >
      <Img
        src={category.image_url}
        alt={title}
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80 transition-transform duration-[1.4s] ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/5 transition-opacity duration-500 group-hover:opacity-95" />
      <div className="absolute inset-0 -z-10 bg-navy/0 transition-colors duration-500 group-hover:bg-navy/35" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-6 sm:p-8">
        <span className="font-display text-sm font-bold tracking-[0.2em] text-white/80" dir="ltr">
          {String(index + 1).padStart(2, '0')}
          <span className="text-white/40"> / 06</span>
        </span>
        <span className="flex h-12 w-12 items-center justify-center border border-white/25 bg-white/5 backdrop-blur-sm transition-colors duration-500 group-hover:border-brand-red group-hover:bg-brand-red">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>

      <div className="relative p-6 sm:p-8">
        <span className="mb-5 block h-[3px] w-10 bg-brand-red transition-all duration-500 group-hover:w-20" />
        <h3 className="display-md max-w-md text-white">{title}</h3>
        <p className="mt-3 max-w-md text-[15px] text-white/70">{loc(category.description)}</p>
        <span className="btn-link mt-6 !text-white group-hover:!text-white">
          {t('common.discover')}
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100" />
        </span>
      </div>
    </Link>
  );
}
