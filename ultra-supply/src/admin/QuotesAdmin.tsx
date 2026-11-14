import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Mail, Paperclip, Phone, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { QuoteRequest, QuoteStatus } from '@/lib/types';
import { Badge, Card, ConfirmDelete, Modal, PageHeader, fmtDate, toast } from './ui';

export const STATUS_LABEL: Record<QuoteStatus, string> = { new: 'Nouveau', in_progress: 'En cours', answered: 'Répondu', archived: 'Archivé' };
export const STATUS_TONE: Record<QuoteStatus, 'red' | 'navy' | 'green' | 'gray'> = { new: 'red', in_progress: 'navy', answered: 'green', archived: 'gray' };

export default function QuotesAdmin() {
  const [items, setItems] = useState<QuoteRequest[]>([]);
  const [status, setStatus] = useState<QuoteStatus | ''>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<QuoteRequest | null>(null);
  const load = useCallback(async () => setItems(await api.listQuotes()), []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return items.filter((x) => (!status || x.status === status) && (!n || [x.full_name, x.company, x.email, x.product, x.reference].join(' ').toLowerCase().includes(n)));
  }, [items, status, q]);

  const setQuoteStatus = async (id: string, s: QuoteStatus) => {
    await api.updateQuoteStatus(id, s);
    toast('Statut mis à jour');
    setOpen((o) => (o && o.id === id ? { ...o, status: s } : o));
    await load();
  };

  const exportCsv = () => {
    const cols: (keyof QuoteRequest)[] = ['created_at', 'status', 'full_name', 'company', 'email', 'phone', 'product', 'reference', 'quantity', 'message', 'locale'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(';'), ...filtered.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `devis-ultra-supply-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader title="Demandes de devis" subtitle={`${items.filter((x) => x.status === 'new').length} nouvelle(s) · ${items.length} au total`}
        actions={<button className="btn btn-ghost !min-h-[42px]" onClick={exportCsv} disabled={!filtered.length}><Download className="h-4 w-4" /> Export CSV</button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-navy/10 p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <input className="field !min-h-[42px] !py-2 !pl-10" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          </label>
          <div className="flex flex-wrap gap-1">
            {(['', 'new', 'in_progress', 'answered', 'archived'] as const).map((s) => (
              <button key={s || 'all'} onClick={() => setStatus(s)} className={`min-h-[42px] px-4 text-xs font-semibold ${status === s ? 'bg-navy text-white' : 'bg-mist text-navy hover:bg-navy-100'}`}>{s ? STATUS_LABEL[s] : 'Tous'}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-mist text-[11px] uppercase tracking-wider text-navy/60">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Qté</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {filtered.map((x) => (
                <tr key={x.id} className={`cursor-pointer hover:bg-mist/60 ${x.status === 'new' ? 'font-medium' : ''}`} onClick={() => setOpen(x)}>
                  <td className="whitespace-nowrap px-4 py-3 text-navy/60">{fmtDate(x.created_at)}</td>
                  <td className="px-4 py-3"><p className="text-navy">{x.full_name}</p><p className="text-xs text-navy/50">{x.company || x.email}</p></td>
                  <td className="px-4 py-3"><p className="text-navy">{x.product}</p>{x.reference && <p className="font-mono text-xs text-navy/50">{x.reference}</p>}</td>
                  <td className="px-4 py-3">{x.quantity}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Badge tone={STATUS_TONE[x.status]}>{STATUS_LABEL[x.status]}</Badge>{x.attachment_path && <Paperclip className="h-3.5 w-3.5 text-navy/40" />}</div></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><ConfirmDelete onConfirm={async () => { await api.deleteQuote(x.id); toast('Demande supprimée'); await load(); }} /></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-navy/50">Aucune demande.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <QuoteDetail quote={open} onClose={() => setOpen(null)} onStatus={(s) => setQuoteStatus(open.id, s)} />}
    </>
  );
}

function QuoteDetail({ quote, onClose, onStatus }: { quote: QuoteRequest; onClose: () => void; onStatus: (s: QuoteStatus) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (quote.attachment_path) void api.getAttachmentUrl(quote.attachment_path).then(setUrl);
  }, [quote.attachment_path]);
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-4 py-2.5 text-sm"><dt className="text-navy/50">{label}</dt><dd className="col-span-2 break-words text-navy">{value || '—'}</dd></div>
  );
  return (
    <Modal open wide title={`Devis — ${quote.full_name}`} onClose={onClose}
      footer={<>
        <a href={`mailto:${quote.email}?subject=${encodeURIComponent('Votre demande de devis — ULTRA SUPPLY')}`} className="btn btn-red !min-h-[42px]"><Mail className="h-4 w-4" /> Répondre</a>
        <a href={`tel:${quote.phone}`} className="btn btn-ghost !min-h-[42px]"><Phone className="h-4 w-4" /> Appeler</a>
      </>}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm text-navy/60">Statut :</span>
        {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
          <button key={s} onClick={() => onStatus(s)} className={`min-h-[36px] px-3 text-xs font-semibold ${quote.status === s ? 'bg-navy text-white' : 'bg-mist text-navy hover:bg-navy-100'}`}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      <dl className="divide-y divide-navy/10 border-y border-navy/10">
        {row('Reçu le', fmtDate(quote.created_at))}
        {row('Nom', quote.full_name)}
        {row('Entreprise', quote.company)}
        {row('E-mail', <a className="underline" href={`mailto:${quote.email}`}>{quote.email}</a>)}
        {row('Téléphone', <a className="underline" href={`tel:${quote.phone}`}>{quote.phone}</a>)}
        {row('Produit', quote.product)}
        {row('Référence', <span className="font-mono">{quote.reference}</span>)}
        {row('Quantité', quote.quantity)}
        {row('Langue', quote.locale.toUpperCase())}
        {row('Message', <span className="whitespace-pre-wrap">{quote.message}</span>)}
        {row('Pièce jointe', quote.attachment_path ? (url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><Paperclip className="h-3.5 w-3.5" /> Ouvrir le fichier</a> : <span className="text-navy/50">{quote.attachment_path.startsWith('demo:') ? quote.attachment_path.slice(5) + ' (non stocké en mode démo)' : 'Chargement…'}</span>) : null)}
      </dl>
    </Modal>
  );
}
