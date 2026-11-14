import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/i18n';

interface Props {
  title?: string;
  description: string;
  image?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

const SITE = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
const OG_LOCALE = { fr: 'fr_TN', en: 'en_US', ar: 'ar_TN' } as const;

export function Seo({ title, description, image, noindex, jsonLd }: Props) {
  const { locale, t } = useI18n();
  const { pathname } = useLocation();
  const fullTitle = title ? `${title} | ULTRA SUPPLY` : t('seo.home.title');
  const origin = SITE || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${origin}${pathname}`;
  const img = image ? (image.startsWith('http') ? image : `${origin}${image}`) : `${origin}/og-image.png`;

  return (
    <Helmet>
      <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
