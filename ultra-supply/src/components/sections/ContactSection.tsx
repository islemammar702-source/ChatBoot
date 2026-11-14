import { Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { SectionHeading } from '../SectionHeading';
import { ContactForm } from '../forms/ContactForm';
import { Reveal } from '../Reveal';
import { useI18n } from '@/i18n';

export function ContactSection({ heading = true }: { heading?: boolean }) {
  const { t } = useI18n();
  const phone = t('contact.phoneValue');
  const wa = t('contact.whatsappValue');
  const email = t('contact.emailValue');
  const digits = (s: string) => s.replace(/[^\d+]/g, '');
  const isReal = (s: string) => !/X{2,}/i.test(s) && digits(s).replace('+', '').length >= 8;
  const isRealEmail = !/votre-domaine|your-domain|example\./i.test(email);

  const items: { Icon: LucideIcon; label: string; value: string; href?: string; ltr?: boolean }[] = [
    { Icon: Phone, label: t('contact.phone'), value: phone, href: isReal(phone) ? `tel:${digits(phone)}` : undefined, ltr: true },
    { Icon: MessageCircle, label: t('contact.whatsapp'), value: wa, href: isReal(wa) ? `https://wa.me/${digits(wa).replace('+', '')}` : undefined, ltr: true },
    { Icon: Mail, label: t('contact.email'), value: email, href: isRealEmail ? `mailto:${email}` : undefined, ltr: true },
    { Icon: MapPin, label: t('contact.address'), value: t('contact.addressValue') },
  ];
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(t('contact.mapQuery'))}&output=embed`;

  return (
    <section id="contact" aria-labelledby={heading ? 'contact-title' : undefined} className="scroll-mt-24 py-24 sm:py-32">
      <div className="container-site">
        {heading && <SectionHeading id="contact-title" label={t('contact.label')} title={t('contact.title')} subtitle={t('contact.subtitle')} />}
        <div className={`grid gap-12 lg:grid-cols-12 ${heading ? 'mt-14' : ''}`}>
          <Reveal className="lg:col-span-5">
            <ul className="grid gap-px border border-navy/10 bg-navy/10 sm:grid-cols-2 lg:grid-cols-1">
              {items.map(({ Icon, label, value, href, ltr }) => {
                const body = (
                  <>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-white transition-colors group-hover:bg-brand-red">
                      <Icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-navy/50 rtl:text-[13px] rtl:normal-case rtl:tracking-normal">{label}</span>
                      <span className="mt-1 block break-words text-[16px] font-medium text-navy" dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'start', unicodeBidi: 'plaintext' } : undefined}>{value}</span>
                    </span>
                  </>
                );
                return (
                  <li key={label} className="bg-white">
                    {href ? (
                      <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="group flex items-center gap-5 p-6 hover:bg-mist">{body}</a>
                    ) : (
                      <div className="group flex items-center gap-5 p-6">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 aspect-[4/3] w-full overflow-hidden border border-navy/10 bg-mist">
              <iframe
                title={t('contact.mapTitle')}
                src={mapSrc}
                className="h-full w-full grayscale-[0.4]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </Reveal>
          <Reveal delay={120} className="lg:col-span-7">
            <div className="border border-navy/10 bg-white p-6 shadow-[0_40px_80px_-50px_rgba(10,36,69,0.35)] sm:p-10">
              <h3 className="display-md text-navy">{t('contact.formTitle')}</h3>
              <span className="mt-5 block h-[3px] w-10 bg-brand-red" />
              <div className="mt-8"><ContactForm /></div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
