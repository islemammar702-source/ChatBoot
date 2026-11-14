import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, FolderTree, Handshake, Mail, Package } from 'lucide-react';
import { api } from '@/lib/api';
import type { ContactMessage, QuoteRequest } from '@/lib/types';
import { Badge, Card, PageHeader, fmtDate } from './ui';
import { STATUS_LABEL, STATUS_TONE } from './QuotesAdmin';

export default function Dashboard() {
  const [data, setData] = useState<{ products: number; categories: number; partners: number; quotes: QuoteRequest[]; messages: ContactMessage[] } | null>(null);

  useEffect(() => {
    void Promise.all([
      api.listProducts({ includeUnpublished: true }), api.listCategories(), api.listPartners({ includeUnpublished: true }),
      api.listQuotes(), api.listMessages(),
    ]).then(([p, c, pa, q, m]) => setData({ products: p.length, categories: c.length, partners: pa.length, quotes: q, messages: m }));
  }, []);

  const stats = [
    { label: 'Nouvelles demandes de devis', value: data?.quotes.filter((q) => q.status === 'new').length, Icon: FileText, to: '/admin/quotes', accent: true },
    { label: 'Messages non lus', value: data?.messages.filter((m) => !m.is_read).length, Icon: Mail, to: '/admin/messages' },
    { label: 'Produits', value: data?.products, Icon: Package, to: '/admin/products' },
    { label: 'Catégories', value: data?.categories, Icon: FolderTree, to: '/admin/categories' },
    { label: 'Partenaires', value: data?.partners, Icon: Handshake, to: '/admin/partners' },
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité du site." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, Icon, to, accent }) => (
          <Link key={label} to={to} className={`group flex flex-col justify-between p-6 transition-shadow hover:shadow-lg ${accent ? 'bg-navy text-white' : 'border border-navy/10 bg-white'}`}>
            <Icon className={`h-5 w-5 ${accent ? 'text-brand-red' : 'text-navy/50'}`} />
            <p className="mt-6 font-display text-4xl font-extrabold">{value ?? '—'}</p>
            <p className={`mt-1 text-[13px] ${accent ? 'text-white/70' : 'text-navy/60'}`}>{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-navy/10 px-6 py-4">
            <h2 className="font-display font-bold uppercase text-navy">Dernières demandes de devis</h2>
            <Link to="/admin/quotes" className="btn-link !text-[11px]">Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <ul className="divide-y divide-navy/10">
            {data?.quotes.slice(0, 6).map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy">{q.full_name} {q.company && <span className="font-normal text-navy/50">· {q.company}</span>}</p>
                  <p className="truncate text-navy/60">{q.product} × {q.quantity}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={STATUS_TONE[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                  <p className="mt-1 text-xs text-navy/40">{fmtDate(q.created_at)}</p>
                </div>
              </li>
            ))}
            {data && !data.quotes.length && <li className="px-6 py-10 text-center text-sm text-navy/50">Aucune demande pour le moment.</li>}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-navy/10 px-6 py-4">
            <h2 className="font-display font-bold uppercase text-navy">Derniers messages</h2>
            <Link to="/admin/messages" className="btn-link !text-[11px]">Tout voir <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <ul className="divide-y divide-navy/10">
            {data?.messages.slice(0, 6).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                <div className="min-w-0">
                  <p className={`truncate text-navy ${m.is_read ? '' : 'font-semibold'}`}>{m.subject}</p>
                  <p className="truncate text-navy/60">{m.full_name} · {m.email}</p>
                </div>
                <div className="shrink-0 text-right">
                  {!m.is_read && <Badge tone="red">Non lu</Badge>}
                  <p className="mt-1 text-xs text-navy/40">{fmtDate(m.created_at)}</p>
                </div>
              </li>
            ))}
            {data && !data.messages.length && <li className="px-6 py-10 text-center text-sm text-navy/50">Aucun message pour le moment.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
