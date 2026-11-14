import { useSearchParams } from 'react-router-dom';
import { Lock, MessagesSquare, Wrench } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { PageHero } from '@/components/PageHero';
import { Reveal } from '@/components/Reveal';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { useI18n } from '@/i18n';
import { images } from '@/data/images';

export default function Quote() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const side = [
    { Icon: MessagesSquare, title: t('quote.side1'), text: t('quote.side1Text') },
    { Icon: Wrench, title: t('quote.side2'), text: t('quote.side2Text') },
    { Icon: Lock, title: t('quote.side3'), text: t('quote.side3Text') },
  ];
  return (
    <>
      <Seo title={t('quote.pageTitle')} description={t('seo.quote.description')} />
      <PageHero label={t('cta.label')} title={t('cta.title')} intro={t('quote.pageIntro')} image={images.quote} crumbs={[{ label: t('quote.pageTitle') }]} />
      <section className="py-20 sm:py-28">
        <div className="container-site grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <div className="border border-navy/10 bg-white p-6 shadow-[0_40px_80px_-50px_rgba(10,36,69,0.35)] sm:p-10">
              <h2 className="display-md text-navy">{t('quote.pageTitle')}</h2>
              <span className="mt-5 block h-[3px] w-10 bg-brand-red" />
              <div className="mt-8"><QuoteForm initialProductSlug={params.get('product')} /></div>
            </div>
          </Reveal>
          <aside className="lg:col-span-4">
            <ul className="space-y-px bg-navy/10 lg:sticky lg:top-28">
              {side.map(({ Icon, title, text }, i) => (
                <Reveal as="li" key={title} delay={i * 100} className={`flex gap-5 p-7 ${i === 0 ? 'bg-navy text-white' : 'bg-mist text-navy'}`}>
                  <Icon className={`h-7 w-7 shrink-0 ${i === 0 ? 'text-brand-red' : 'text-navy'}`} strokeWidth={1.3} />
                  <div>
                    <h3 className="font-display text-lg font-bold uppercase rtl:normal-case">{title}</h3>
                    <p className={`mt-2 text-[14.5px] ${i === 0 ? 'text-white/70' : 'text-navy-950/65'}`}>{text}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </>
  );
}
