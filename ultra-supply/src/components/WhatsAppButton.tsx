import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n';

/** Floating WhatsApp shortcut — only shown once a real number is set in the admin. */
export function WhatsAppButton() {
  const { t } = useI18n();
  const digits = t('contact.whatsappValue').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-xl transition-transform hover:scale-105 hover:bg-brand-red"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
