import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { Field } from './Field';
import { SuccessPanel } from './SuccessPanel';
import { useI18n } from '@/i18n';
import { useCatalog } from '@/hooks/useCatalog';
import { api } from '@/lib/api';
import { isEmail, isPhone, validateFile, ACCEPTED_FILES, type Errors } from '@/lib/validation';
import type { DictKey } from '@/i18n/fr';

interface Values {
  full_name: string;
  company: string;
  email: string;
  phone: string;
  product: string;
  reference: string;
  quantity: string;
  message: string;
}

const empty: Values = { full_name: '', company: '', email: '', phone: '', product: '', reference: '', quantity: '1', message: '' };

export function QuoteForm({ initialProductSlug }: { initialProductSlug?: string | null }) {
  const { t, loc, locale } = useI18n();
  const { products } = useCatalog();
  const [values, setValues] = useState<Values>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors<Values & { file: string }>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [honeypot, setHoneypot] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const productOptions = useMemo(() => products.map((p) => ({ name: loc(p.name), ref: p.reference, slug: p.slug })), [products, loc]);

  useEffect(() => {
    if (!initialProductSlug) return;
    const p = products.find((x) => x.slug === initialProductSlug);
    if (p) setValues((v) => ({ ...v, product: loc(p.name), reference: p.reference }));
  }, [initialProductSlug, products, loc]);

  const set = (k: keyof Values) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => {
      const next = { ...v, [k]: value };
      if (k === 'product') {
        const match = productOptions.find((o) => o.name === value);
        if (match && !v.reference) next.reference = match.ref;
      }
      return next;
    });
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const e: Errors<Values & { file: string }> = {};
    if (values.full_name.trim().length < 2) e.full_name = values.full_name.trim() ? 'form.min' : 'form.required';
    if (!values.email.trim()) e.email = 'form.required';
    else if (!isEmail(values.email)) e.email = 'form.email';
    if (!values.phone.trim()) e.phone = 'form.required';
    else if (!isPhone(values.phone)) e.phone = 'form.phone';
    if (values.product.trim().length < 2) e.product = 'form.required';
    const q = Number(values.quantity);
    if (!Number.isInteger(q) || q < 1 || q > 1_000_000) e.quantity = 'form.quantity';
    const fe = validateFile(file);
    if (fe) e.file = fe;
    return e;
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setErrors((er) => ({ ...er, file: validateFile(f) ?? undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // bot
    const errs = validate();
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      const first = Object.keys(errs)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      await api.submitQuote(
        {
          full_name: values.full_name.trim(),
          company: values.company.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          product: values.product.trim(),
          reference: values.reference.trim(),
          quantity: Number(values.quantity),
          message: values.message.trim(),
          locale,
        },
        file,
      );
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <SuccessPanel
        title={t('quote.successTitle')}
        text={t('quote.successText')}
        action={t('quote.another')}
        onAction={() => {
          setValues(empty);
          setFile(null);
          setStatus('idle');
        }}
      />
    );
  }

  const err = (k: keyof Values | 'file') => (errors[k] ? t(errors[k] as DictKey) : undefined);
  const aria = (k: keyof Values) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `q-${k}-error` : undefined });

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6 sm:grid-cols-2">
      <div className="hidden" aria-hidden>
        <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>
      <Field id="q-full_name" label={t('quote.fullName')} required error={err('full_name')}>
        <input id="q-full_name" name="full_name" className="field" autoComplete="name" maxLength={120} value={values.full_name} onChange={set('full_name')} {...aria('full_name')} />
      </Field>
      <Field id="q-company" label={t('quote.company')} error={err('company')}>
        <input id="q-company" name="company" className="field" autoComplete="organization" maxLength={160} value={values.company} onChange={set('company')} />
      </Field>
      <Field id="q-email" label={t('quote.email')} required error={err('email')}>
        <input id="q-email" name="email" type="email" dir="ltr" className="field rtl:text-right" autoComplete="email" maxLength={200} value={values.email} onChange={set('email')} {...aria('email')} />
      </Field>
      <Field id="q-phone" label={t('quote.phone')} required error={err('phone')}>
        <input id="q-phone" name="phone" type="tel" dir="ltr" className="field rtl:text-right" autoComplete="tel" maxLength={30} value={values.phone} onChange={set('phone')} {...aria('phone')} />
      </Field>
      <Field id="q-product" label={t('quote.product')} required error={err('product')} className="sm:col-span-2">
        <input id="q-product" name="product" list="q-products" className="field" placeholder={t('quote.productPlaceholder')} maxLength={200} value={values.product} onChange={set('product')} {...aria('product')} />
        <datalist id="q-products">
          {productOptions.map((o) => <option key={o.slug} value={o.name}>{o.ref}</option>)}
        </datalist>
      </Field>
      <Field id="q-reference" label={t('quote.reference')} error={err('reference')}>
        <input id="q-reference" name="reference" dir="ltr" className="field font-mono rtl:text-right" maxLength={120} value={values.reference} onChange={set('reference')} />
      </Field>
      <Field id="q-quantity" label={t('quote.quantity')} required error={err('quantity')}>
        <input id="q-quantity" name="quantity" type="number" inputMode="numeric" min={1} max={1000000} step={1} className="field" value={values.quantity} onChange={set('quantity')} {...aria('quantity')} />
      </Field>
      <Field id="q-message" label={t('quote.message')} className="sm:col-span-2">
        <textarea id="q-message" name="message" rows={5} maxLength={4000} className="field resize-y" placeholder={t('quote.messagePlaceholder')} value={values.message} onChange={set('message')} />
      </Field>

      <div className="sm:col-span-2">
        <span className="field-label">{t('quote.attachment')}</span>
        <div className={`flex flex-wrap items-center gap-4 border border-dashed p-4 ${errors.file ? 'border-brand-red' : 'border-navy/25'}`}>
          <input ref={fileRef} id="q-file" name="file" type="file" accept={ACCEPTED_FILES.join(',')} onChange={onFile} className="sr-only" aria-describedby="q-file-hint" />
          <label htmlFor="q-file" className="btn btn-ghost !min-h-[44px] cursor-pointer !px-5">
            <Paperclip className="h-4 w-4" /> {t('quote.attachmentChoose')}
          </label>
          {file ? (
            <span className="flex min-w-0 items-center gap-2 text-[14px] text-navy">
              <span className="truncate">{file.name}</span>
              <button type="button" className="flex h-9 w-9 items-center justify-center text-navy/60 hover:text-brand-red" aria-label={t('quote.attachmentRemove')}
                onClick={() => { setFile(null); setErrors((er) => ({ ...er, file: undefined })); if (fileRef.current) fileRef.current.value = ''; }}>
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <span id="q-file-hint" className="text-[13px] text-navy/50">{t('quote.attachmentHint')}</span>
          )}
        </div>
        {errors.file && <p role="alert" className="field-error">{err('file')}</p>}
      </div>

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-navy/50">{t('form.requiredNote')} {t('form.privacy')}</p>
        <button type="submit" disabled={status === 'sending'} className="btn btn-red shrink-0">
          {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
          {status === 'sending' ? t('quote.sending') : t('quote.submit')}
        </button>
      </div>
      {status === 'error' && <p role="alert" className="field-error sm:col-span-2">{t('common.error')}</p>}
    </form>
  );
}
