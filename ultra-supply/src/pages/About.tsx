import { Compass, Target } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { WhySection } from '@/components/sections/WhySection';
import { CtaSection } from '@/components/sections/CtaSection';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';
import type { DictKey } from '@/i18n/fr';

export default function About() {
  const { t } = useI18n();
  return (
    <>
      <Seo title={t('nav.about')} description={t('seo.about.description')} />
      <PageHero label={t('intro.label')} title={t('about.pageTitle')} intro={t('about.pageIntro')} image={images.about} crumbs={[{ label: t('nav.about') }]} />

      <section className="py-24 sm:py-32">
        <div className="container-site grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <span className="eyebrow">{t('intro.label')}</span>
            <h2 className="display-lg mt-6 text-navy">{t('intro.title')}</h2>
          </Reveal>
          <Reveal delay={120} className="space-y-6 text-[18px] leading-relaxed text-navy-950/70 lg:col-span-6 lg:pt-14">
            <p>{t('intro.p1')}</p>
            <p>{t('intro.p2')}</p>
          </Reveal>
        </div>

        <div className="container-site mt-20 grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <Img src={images.warehouse} alt="" className="aspect-[16/9] w-full object-cover" />
          </Reveal>
          <div className="grid gap-4 lg:col-span-4">
            {[
              { Icon: Target, title: t('about.missionTitle'), text: t('about.missionText'), dark: true },
              { Icon: Compass, title: t('about.visionTitle'), text: t('about.visionText'), dark: false },
            ].map(({ Icon, title, text, dark }, i) => (
              <Reveal key={title} delay={i * 120} className={`flex flex-col justify-center p-8 sm:p-10 ${dark ? 'bg-navy text-white' : 'bg-mist text-navy'}`}>
                <Icon className={`h-8 w-8 ${dark ? 'text-brand-red' : 'text-navy'}`} strokeWidth={1.2} />
                <h3 className="mt-6 font-display text-2xl font-bold uppercase rtl:normal-case">{title}</h3>
                <p className={`mt-3 text-[15.5px] ${dark ? 'text-white/75' : 'text-navy-950/70'}`}>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-950 py-20 text-white" aria-labelledby="values-title">
        <div className="container-site">
          <h2 id="values-title" className="eyebrow">{t('about.valuesTitle')}</h2>
          <ul className="mt-10 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="bg-navy-950 py-8 sm:px-8">
                <span className="font-display text-sm font-bold text-brand-red" dir="ltr">0{n}</span>
                <p className="mt-4 font-display text-[clamp(1.4rem,2.2vw,2rem)] font-extrabold uppercase leading-tight rtl:normal-case">{t(`about.value${n}` as DictKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <WhySection />
      <CtaSection />
    </>
  );
}
