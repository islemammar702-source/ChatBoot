import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { useI18n } from '@/i18n';

export default function NotFound({ message }: { message?: string }) {
  const { t } = useI18n();
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden pb-20 pt-36">
      <Seo title={t('notFound.title')} description={t('notFound.text')} noindex />
      <span className="pointer-events-none absolute -end-10 top-1/2 -translate-y-1/2 select-none font-display text-[16rem] font-black leading-none text-mist sm:text-[24rem]" dir="ltr" aria-hidden>404</span>
      <div className="container-site relative">
        <span className="eyebrow">404</span>
        <h1 className="display-lg mt-5 text-navy">{t('notFound.title')}</h1>
        <p className="mt-5 max-w-lg text-[17px] text-navy-950/65">{message ?? t('notFound.text')}</p>
        <Link to="/" className="btn btn-navy mt-10"><ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('notFound.home')}</Link>
      </div>
    </section>
  );
}
