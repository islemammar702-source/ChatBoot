import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Img } from '../Img';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export function CtaSection() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-navy text-white">
      <div className="grid lg:grid-cols-12">
        <div className="relative px-4 py-20 sm:px-10 sm:py-28 lg:col-span-7 lg:ps-[max(2.5rem,calc((100vw-1360px)/2+2.5rem))] lg:pe-16">
          <div className="grain absolute inset-0 -z-10" />
          <Reveal>
            <span className="eyebrow !text-white before:!bg-brand-red">{t('cta.label')}</span>
            <h2 id="cta-title" className="display-lg mt-6 max-w-2xl">{t('cta.title')}</h2>
            <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/75">{t('cta.text')}</p>
            <Link to="/quote" className="btn btn-red mt-10 !min-h-[56px] !px-9">
              {t('cta.button')} <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </Reveal>
        </div>
        <div className="relative min-h-[320px] lg:col-span-5">
          <Img src={images.quote} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-brand-red mix-blend-multiply opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-transparent to-transparent rtl:bg-gradient-to-l" />
          <span className="absolute bottom-8 end-8 font-display text-[5rem] font-black uppercase leading-none text-white/15 sm:text-[7rem]" dir="ltr" aria-hidden>RFQ</span>
        </div>
      </div>
    </section>
  );
}
