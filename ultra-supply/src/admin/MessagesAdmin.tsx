import { useCallback, useEffect, useState } from 'react';
import { Mail, MailOpen } from 'lucide-react';
import { api } from '@/lib/api';
import type { ContactMessage } from '@/lib/types';
import { Badge, Card, ConfirmDelete, PageHeader, fmtDate, toast } from './ui';

export default function MessagesAdmin() {
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => setItems(await api.listMessages()), []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (m: ContactMessage) => {
    setOpenId((id) => (id === m.id ? null : m.id));
    if (!m.is_read) {
      await api.setMessageRead(m.id, true);
      await load();
    }
  };

  return (
    <>
      <PageHeader title="Messages de contact" subtitle={`${items.filter((m) => !m.is_read).length} non lu(s) · ${items.length} au total`} />
      <Card>
        <ul className="divide-y divide-navy/10">
          {items.map((m) => (
            <li key={m.id}>
              <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-mist/60" onClick={() => void toggle(m)} aria-expanded={openId === m.id}>
                {m.is_read ? <MailOpen className="h-4 w-4 shrink-0 text-navy/30" /> : <Mail className="h-4 w-4 shrink-0 text-brand-red" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-navy ${m.is_read ? '' : 'font-semibold'}`}>{m.subject}</p>
                  <p className="truncate text-sm text-navy/55">{m.full_name} · {m.email}</p>
                </div>
                {!m.is_read && <Badge tone="red">Non lu</Badge>}
                <span className="hidden shrink-0 text-xs text-navy/40 sm:block">{fmtDate(m.created_at)}</span>
              </button>
              {openId === m.id && (
                <div className="border-t border-navy/10 bg-mist/60 px-5 py-5 sm:pl-14">
                  <p className="whitespace-pre-wrap text-[15px] text-navy">{m.message}</p>
                  {m.phone && <p className="mt-3 text-sm text-navy/60">Tél. : <a className="underline" href={`tel:${m.phone}`}>{m.phone}</a></p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a className="btn btn-red !min-h-[38px] !px-4 !text-[11px]" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.subject)}`}>Répondre</a>
                    <button className="btn btn-ghost !min-h-[38px] !px-4 !text-[11px]" onClick={async () => { await api.setMessageRead(m.id, false); toast('Marqué non lu'); await load(); }}>Marquer non lu</button>
                    <ConfirmDelete onConfirm={async () => { await api.deleteMessage(m.id); toast('Message supprimé'); setOpenId(null); await load(); }} />
                  </div>
                </div>
              )}
            </li>
          ))}
          {!items.length && <li className="px-5 py-12 text-center text-navy/50">Aucun message.</li>}
        </ul>
      </Card>
    </>
  );
}
