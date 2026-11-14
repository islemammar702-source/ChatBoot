import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { api, uid } from '@/lib/api';
import { useCatalog } from '@/hooks/useCatalog';
import { emptyTranslated, type Category } from '@/lib/types';
import { Card, ConfirmDelete, ImageUpload, Modal, PageHeader, TranslatedInput, slugify, toast } from './ui';

export default function CategoriesAdmin() {
  const { refresh } = useCatalog();
  const [items, setItems] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Category | null>(null);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([api.listCategories(), api.listProducts({ includeUnpublished: true })]);
    setItems(c);
    setCounts(p.reduce<Record<string, number>>((acc, x) => { if (x.category_id) acc[x.category_id] = (acc[x.category_id] ?? 0) + 1; return acc; }, {}));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const after = async () => { await Promise.all([load(), refresh()]); };

  return (
    <>
      <PageHeader title="Catégories" subtitle="Les catégories correspondent aux domaines d'expertise affichés sur le site."
        actions={<button className="btn btn-red !min-h-[42px]" onClick={() => setEditing({ id: uid(), slug: '', name: emptyTranslated(), description: emptyTranslated(), image_url: null, sort_order: items.length + 1 })}><Plus className="h-4 w-4" /> Ajouter</button>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <Card key={c.id} className="flex flex-col overflow-hidden">
            <div className="aspect-[16/9] bg-mist">{c.image_url && <img src={c.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-semibold text-brand-red">#{c.sort_order} · {counts[c.id] ?? 0} produit(s)</p>
              <h2 className="mt-1 font-display text-lg font-bold uppercase text-navy">{c.name.fr}</h2>
              <p className="text-sm text-navy/50">{c.name.en} · <span dir="rtl" className="font-arabic">{c.name.ar}</span></p>
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-navy/70">{c.description.fr}</p>
              <div className="mt-4 flex justify-end gap-1 border-t border-navy/10 pt-3">
                <button className="flex h-9 w-9 items-center justify-center text-navy/50 hover:text-navy" aria-label="Modifier" onClick={() => setEditing(structuredClone(c))}><Pencil className="h-4 w-4" /></button>
                <ConfirmDelete onConfirm={async () => { try { await api.deleteCategory(c.id); toast('Catégorie supprimée'); await after(); } catch (e) { toast(e instanceof Error ? e.message : 'Erreur', 'err'); } }} />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {editing && <CategoryEditor item={editing} existing={items} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await after(); }} />}
    </>
  );
}

function CategoryEditor({ item, existing, onClose, onSaved }: { item: Category; existing: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [c, setC] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !existing.some((x) => x.id === item.id);

  const save = async () => {
    const slug = c.slug || slugify(c.name.fr);
    if (!c.name.fr.trim()) return setError('Le nom (FR) est obligatoire.');
    if (existing.some((x) => x.slug === slug && x.id !== c.id)) return setError('Identifiant déjà utilisé.');
    setBusy(true);
    try {
      await api.saveCategory({ ...c, slug });
      toast(isNew ? 'Catégorie ajoutée' : 'Catégorie mise à jour');
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open wide title={isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'} onClose={onClose}
      footer={<>{error && <p className="mr-auto self-center text-sm text-brand-red">{error}</p>}<button className="btn btn-ghost !min-h-[42px]" onClick={onClose}>Annuler</button><button className="btn btn-red !min-h-[42px]" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</button></>}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <TranslatedInput label="Nom" required value={c.name} onChange={(v) => setC({ ...c, name: v })} />
          <TranslatedInput label="Description" multiline value={c.description} onChange={(v) => setC({ ...c, description: v })} />
        </div>
        <div className="space-y-5">
          <ImageUpload value={c.image_url} onChange={(v) => setC({ ...c, image_url: v })} folder="categories" />
          <div><label className="field-label" htmlFor="c-slug">URL (slug)</label><input id="c-slug" className="field" placeholder={slugify(c.name.fr) || 'auto'} value={c.slug} onChange={(e) => setC({ ...c, slug: slugify(e.target.value) })} /></div>
          <div><label className="field-label" htmlFor="c-order">Ordre d'affichage</label><input id="c-order" type="number" className="field" value={c.sort_order} onChange={(e) => setC({ ...c, sort_order: Number(e.target.value) || 0 })} /></div>
        </div>
      </div>
    </Modal>
  );
}
