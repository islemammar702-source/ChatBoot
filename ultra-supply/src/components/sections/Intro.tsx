import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Img } from '../Img';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export function Intro() {
  const { t } = useI18n();
  return (
    <section id="intro" aria-labelledby="intro-title" className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32 lg:py-40">
      <div className="container-site grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal className="relative lg:col-span-7">
          <div className="relative">
            <Img src={images.intro} alt={t('intro.caption')} className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[6/5]" />
            <div className="absolute -bottom-10 end-6 hidden w-[42%] border-[10px] border-white bg-white shadow-2xl sm:block lg:-end-10">
              <Img src={images.introSecondary} alt="" className="aspect-square w-full object-cover" />
            </div>
            <span className="absolute -start-3 -top-3 h-24 w-24 border-s-[6px] border-t-[6px] border-brand-red sm:-start-5 sm:-top-5" aria-hidden />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-navy/45 rtl:tracking-normal">{t('intro.caption')}</p>
        </Reveal>

        <Reveal delay={150} className="lg:col-span-5 lg:ps-10">
          <span className="eyebrow">{t('intro.label')}</span>
          <h2 id="intro-title" className="display-lg mt-6 text-navy">{t('intro.title')}</h2>
          <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-navy-950/70">
            <p>{t('intro.p1')}</p>
            <p>{t('intro.p2')}</p>
          </div>
          <div className="mt-10 flex items-center gap-6">
            <Link to="/about" className="btn btn-navy">
              {t('common.discoverMore')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
            <span className="h-px flex-1 bg-navy/10" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
