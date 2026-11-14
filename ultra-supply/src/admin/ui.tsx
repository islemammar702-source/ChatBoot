import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ImagePlus, Loader2, Trash2, X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import type { Locale, Translated } from '@/lib/types';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-navy sm:text-3xl" style={{ fontStretch: '106%' }}>{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-navy/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`border border-navy/10 bg-white ${className}`}>{children}</div>;
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy-950/60 p-4 backdrop-blur-sm sm:p-8" dir="ltr" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`relative w-full bg-white shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-navy/10 px-6 py-4">
          <h2 className="font-display text-lg font-bold uppercase text-navy">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center text-navy/60 hover:text-navy" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-navy/10 bg-mist px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDelete({ onConfirm, label = 'Supprimer' }: { onConfirm: () => Promise<void> | void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center text-navy/50 hover:bg-brand-red/10 hover:text-brand-red" aria-label={label} title={label}>
        <Trash2 className="h-4 w-4" />
      </button>
      <Modal open={open} title="Confirmer la suppression" onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setOpen(false)}>Annuler</button>
            <button type="button" disabled={busy} className="btn btn-red !min-h-[40px]" onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Supprimer
            </button>
          </>
        }>
        <div className="flex gap-4">
          <AlertTriangle className="h-6 w-6 shrink-0 text-brand-red" />
          <p className="text-navy/80">Cette action est définitive. Voulez-vous vraiment continuer ?</p>
        </div>
      </Modal>
    </>
  );
}

const LANGS: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'FR' }, { code: 'en', label: 'EN' }, { code: 'ar', label: 'AR' },
];

export function TranslatedInput({ label, value, onChange, multiline, required }: {
  label: string; value: Translated; onChange: (v: Translated) => void; multiline?: boolean; required?: boolean;
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}{required && <span className="text-brand-red"> *</span>}</legend>
      <div className="space-y-2">
        {LANGS.map((l) => {
          const common = {
            value: value[l.code],
            dir: l.code === 'ar' ? 'rtl' : 'ltr',
            lang: l.code,
            'aria-label': `${label} (${l.label})`,
            className: `field !ps-14 ${l.code === 'ar' ? 'font-arabic' : ''}`,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [l.code]: e.target.value }),
          } as const;
          return (
            <div key={l.code} className="relative">
              <span className="pointer-events-none absolute left-0 top-0 flex h-12 w-11 items-center justify-center border-r border-navy/10 bg-mist text-[11px] font-bold text-navy/60">{l.label}</span>
              {multiline ? <textarea rows={3} {...common} /> : <input {...common} />}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ImageUpload({ value, onChange, folder, label = 'Image' }: { value: string | null; onChange: (url: string | null) => void; folder: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Format non supporté.');
    if (file.size > 5 * 1024 * 1024) return setError('Image trop lourde (5 Mo max).');
    setBusy(true);
    setError(null);
    try {
      onChange(await api.uploadImage(file, folder));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du téléversement');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex gap-4">
        <div className="flex h-28 w-36 shrink-0 items-center justify-center overflow-hidden border border-navy/10 bg-mist">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-navy/30" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <input ref={ref} type="file" accept="image/*" className="sr-only" id={`up-${folder}`} onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={`up-${folder}`} className="btn btn-navy !min-h-[38px] cursor-pointer !px-4 !text-[11px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Téléverser
            </label>
            <button type="button" className="btn btn-ghost !min-h-[38px] !px-4 !text-[11px]" onClick={() => setUrlMode((m) => !m)}>URL</button>
            {value && <button type="button" className="btn btn-ghost !min-h-[38px] !px-4 !text-[11px]" onClick={() => onChange(null)}>Retirer</button>}
          </div>
          {urlMode && <input className="field !min-h-[38px] !py-1.5 text-sm" placeholder="https://…" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} />}
          {error && <p className="text-xs text-brand-red">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/** Lightweight toast notifications. */
let pushToast: ((msg: string, kind?: 'ok' | 'err') => void) | null = null;
export const toast = (msg: string, kind: 'ok' | 'err' = 'ok') => pushToast?.(msg, kind);

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);
  useEffect(() => {
    pushToast = (msg, kind = 'ok') => {
      const id = Date.now() + Math.random();
      setItems((l) => [...l, { id, msg, kind }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 3500);
    };
    return () => { pushToast = null; };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 text-sm text-white shadow-xl ${t.kind === 'ok' ? 'bg-navy' : 'bg-brand-red'}`}>
          {t.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {t.msg}
        </div>
      ))}
    </div>
  );
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Badge({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'red' | 'gray' | 'green' }) {
  const tones = { navy: 'bg-navy-100 text-navy', red: 'bg-brand-red/10 text-brand-red', gray: 'bg-mist text-navy/60', green: 'bg-navy text-white' };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}
