import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Field } from './Field';
import { SuccessPanel } from './SuccessPanel';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { isEmail, isPhone, type Errors } from '@/lib/validation';
import type { DictKey } from '@/i18n/fr';

interface Values { full_name: string; email: string; phone: string; subject: string; message: string }
const empty: Values = { full_name: '', email: '', phone: '', subject: '', message: '' };

export function ContactForm({ idPrefix = 'c' }: { idPrefix?: string }) {
  const { t } = useI18n();
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Errors<Values>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [honeypot, setHoneypot] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: keyof Values) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const e: Errors<Values> = {};
    if (values.full_name.trim().length < 2) e.full_name = values.full_name.trim() ? 'form.min' : 'form.required';
    if (!values.email.trim()) e.email = 'form.required';
    else if (!isEmail(values.email)) e.email = 'form.email';
    if (values.phone.trim() && !isPhone(values.phone)) e.phone = 'form.phone';
    if (values.subject.trim().length < 2) e.subject = values.subject.trim() ? 'form.min' : 'form.required';
    if (values.message.trim().length < 10) e.message = values.message.trim() ? 'form.min' : 'form.required';
    return e;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(errs)[0]}"]`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      await api.submitContact({
        full_name: values.full_name.trim(), email: values.email.trim(), phone: values.phone.trim(),
        subject: values.subject.trim(), message: values.message.trim(),
      });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return <SuccessPanel title={t('contact.successTitle')} text={t('contact.successText')} action={t('contact.another')} onAction={() => { setValues(empty); setStatus('idle'); }} />;
  }

  const id = (k: string) => `${idPrefix}-${k}`;
  const err = (k: keyof Values) => (errors[k] ? t(errors[k] as DictKey) : undefined);
  const aria = (k: keyof Values) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `${id(k)}-error` : undefined });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6 sm:grid-cols-2">
      <div className="hidden" aria-hidden>
        <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>
      <Field id={id('full_name')} label={t('contact.fullName')} required error={err('full_name')}>
        <input id={id('full_name')} name="full_name" className="field" autoComplete="name" maxLength={120} value={values.full_name} onChange={set('full_name')} {...aria('full_name')} />
      </Field>
      <Field id={id('email')} label={t('contact.emailField')} required error={err('email')}>
        <input id={id('email')} name="email" type="email" dir="ltr" className="field rtl:text-right" autoComplete="email" maxLength={200} value={values.email} onChange={set('email')} {...aria('email')} />
      </Field>
      <Field id={id('phone')} label={t('contact.phoneField')} error={err('phone')}>
        <input id={id('phone')} name="phone" type="tel" dir="ltr" className="field rtl:text-right" autoComplete="tel" maxLength={30} value={values.phone} onChange={set('phone')} {...aria('phone')} />
      </Field>
      <Field id={id('subject')} label={t('contact.subject')} required error={err('subject')}>
        <input id={id('subject')} name="subject" className="field" maxLength={200} value={values.subject} onChange={set('subject')} {...aria('subject')} />
      </Field>
      <Field id={id('message')} label={t('contact.message')} required error={err('message')} className="sm:col-span-2">
        <textarea id={id('message')} name="message" rows={5} maxLength={4000} className="field resize-y" value={values.message} onChange={set('message')} {...aria('message')} />
      </Field>
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-navy/50">{t('form.requiredNote')}</p>
        <button type="submit" disabled={status === 'sending'} className="btn btn-navy shrink-0">
          {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
          {status === 'sending' ? t('contact.sending') : t('contact.submit')}
        </button>
      </div>
      {status === 'error' && <p role="alert" className="field-error sm:col-span-2">{t('common.error')}</p>}
    </form>
  );
}
