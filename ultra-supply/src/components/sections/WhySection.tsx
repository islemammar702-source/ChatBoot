import { HeartHandshake, Layers, ShieldCheck, Users } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import type { DictKey } from '@/i18n/fr';

const ITEMS = [
  { n: 1, Icon: ShieldCheck },
  { n: 2, Icon: Layers },
  { n: 3, Icon: HeartHandshake },
  { n: 4, Icon: Users },
] as const;

export function WhySection() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="why-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="container-site">
        <SectionHeading id="why-title" label={t('why.label')} title={t('why.title')} />
        <div className="mt-16 grid border-t border-navy/10 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ n, Icon }, i) => (
            <Reveal
              key={n}
              delay={i * 100}
              className="group relative border-b border-navy/10 py-10 sm:px-8 sm:[&:nth-child(odd)]:border-e lg:border-b-0 lg:border-e lg:last:border-e-0 lg:first:ps-0"
            >
              <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-brand-red transition-transform duration-500 group-hover:scale-x-100 rtl:origin-right" />
              <div className="flex items-start justify-between">
                <span className="font-display text-sm font-bold tracking-[0.2em] text-brand-red" dir="ltr">0{n}</span>
                <Icon className="h-10 w-10 text-navy transition-transform duration-500 group-hover:-translate-y-1" strokeWidth={1} />
              </div>
              <h3 className="mt-12 font-display text-[22px] font-bold uppercase leading-tight text-navy rtl:normal-case">
                {t(`why.${n}.title` as DictKey)}
              </h3>
              <p className="mt-4 text-[15px] text-navy-950/65">{t(`why.${n}.text` as DictKey)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
