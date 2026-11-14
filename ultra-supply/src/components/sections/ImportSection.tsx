import { Link } from 'react-router-dom';
import { ArrowRight, Globe2, Ship, Truck } from 'lucide-react';
import { Img } from '../Img';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export function useImportSteps() {
  const { t } = useI18n();
  return [
    { Icon: Globe2, title: t('import.step1.title'), text: t('import.step1.text'), image: images.sourcing },
    { Icon: Ship, title: t('import.step2.title'), text: t('import.step2.text'), image: images.logistics },
    { Icon: Truck, title: t('import.step3.title'), text: t('import.step3.text'), image: images.distribution },
  ];
}

export function ImportSection({ withLink = true }: { withLink?: boolean }) {
  const { t } = useI18n();
  const steps = useImportSteps();
  return (
    <section aria-labelledby="import-title" className="relative isolate overflow-hidden bg-navy text-white">
      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        <Img src={images.logistics} alt={t('import.step2.title')} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-navy/30 to-navy" />
        <div className="container-site absolute inset-x-0 bottom-0 pb-12">
          <Reveal>
            <span className="eyebrow">{t('import.label')}</span>
            <h2 id="import-title" className="display-lg mt-5 max-w-4xl">{t('import.title')}</h2>
          </Reveal>
        </div>
      </div>

      <div className="container-site pb-24 pt-10 sm:pb-32">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="text-[18px] leading-relaxed text-white/75">{t('import.description')}</p>
            {withLink && (
              <Link to="/import-distribution" className="btn btn-red mt-10">
                {t('common.discoverMore')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            )}
          </Reveal>
          <ol className="grid gap-px bg-white/10 sm:grid-cols-3 lg:col-span-8">
            {steps.map(({ Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 120} className="group relative bg-navy p-8 transition-colors duration-500 hover:bg-navy-900">
                <div className="flex items-center justify-between">
                  <Icon className="h-9 w-9 text-white" strokeWidth={1.25} />
                  <span className="font-display text-5xl font-black text-white/10 transition-colors duration-500 group-hover:text-brand-red" dir="ltr">0{i + 1}</span>
                </div>
                <h3 className="mt-10 font-display text-xl font-bold uppercase rtl:normal-case">{title}</h3>
                <p className="mt-3 text-[15px] text-white/65">{text}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute -end-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 bg-brand-red p-1 sm:block rtl:rotate-180" aria-hidden />
                )}
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
