import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { api, uid } from '@/lib/api';
import { useCatalog } from '@/hooks/useCatalog';
import type { Partner } from '@/lib/types';
import { Badge, Card, ConfirmDelete, ImageUpload, Modal, PageHeader, toast } from './ui';

export default function PartnersAdmin() {
  const { refresh } = useCatalog();
  const [items, setItems] = useState<Partner[]>([]);
  const [editing, setEditing] = useState<Partner | null>(null);
  const load = useCallback(async () => setItems(await api.listPartners({ includeUnpublished: true })), []);
  useEffect(() => { void load(); }, [load]);
  const after = async () => { await Promise.all([load(), refresh()]); };

  return (
    <>
      <PageHeader title="Marques & partenaires" subtitle="Ajoutez uniquement des partenaires réels, avec leur accord. Les emplacements sans logo s'affichent comme espaces réservés."
        actions={<button className="btn btn-red !min-h-[42px]" onClick={() => setEditing({ id: uid(), name: '', logo_url: null, website: null, sort_order: items.length + 1, published: true })}><Plus className="h-4 w-4" /> Ajouter</button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <div className="flex aspect-[3/2] items-center justify-center bg-mist p-6">
              {p.logo_url ? <img src={p.logo_url} alt={p.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs uppercase tracking-widest text-navy/30">Sans logo</span>}
            </div>
            <div className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy">{p.name}</p>
                <div className="mt-1 flex gap-1">{p.published ? <Badge tone="green">Visible</Badge> : <Badge tone="gray">Masqué</Badge>}<Badge tone="gray">#{p.sort_order}</Badge></div>
              </div>
              <div className="flex">
                <button className="flex h-9 w-9 items-center justify-center text-navy/50 hover:text-navy" aria-label="Modifier" onClick={() => setEditing({ ...p })}><Pencil className="h-4 w-4" /></button>
                <ConfirmDelete onConfirm={async () => { await api.deletePartner(p.id); toast('Partenaire supprimé'); await after(); }} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && <PartnerEditor item={editing} isNew={!items.some((x) => x.id === editing.id)} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await after(); }} />}
    </>
  );
}

function PartnerEditor({ item, isNew, onClose, onSaved }: { item: Partner; isNew: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [p, setP] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!p.name.trim()) return setError('Le nom est obligatoire.');
    if (p.website && !/^https?:\/\//.test(p.website)) return setError('Le site web doit commencer par http(s)://');
    setBusy(true);
    try {
      await api.savePartner({ ...p, name: p.name.trim(), website: p.website?.trim() || null });
      toast(isNew ? 'Partenaire ajouté' : 'Partenaire mis à jour');
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={isNew ? 'Nouveau partenaire' : 'Modifier le partenaire'} onClose={onClose}
      footer={<>{error && <p className="mr-auto self-center text-sm text-brand-red">{error}</p>}<button className="btn btn-ghost !min-h-[42px]" onClick={onClose}>Annuler</button><button className="btn btn-red !min-h-[42px]" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</button></>}>
      <div className="space-y-5">
        <div><label className="field-label" htmlFor="pa-name">Nom *</label><input id="pa-name" className="field" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
        <ImageUpload value={p.logo_url} onChange={(v) => setP({ ...p, logo_url: v })} folder="partners" label="Logo" />
        <div><label className="field-label" htmlFor="pa-web">Site web</label><input id="pa-web" className="field" placeholder="https://" value={p.website ?? ''} onChange={(e) => setP({ ...p, website: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="field-label" htmlFor="pa-order">Ordre</label><input id="pa-order" type="number" className="field" value={p.sort_order} onChange={(e) => setP({ ...p, sort_order: Number(e.target.value) || 0 })} /></div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-navy" checked={p.published} onChange={(e) => setP({ ...p, published: e.target.checked })} /> Visible sur le site</label>
        </div>
      </div>
    </Modal>
  );
}
