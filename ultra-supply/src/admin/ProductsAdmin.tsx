import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Pencil, Plus, Search, Star, X } from 'lucide-react';
import { api, uid } from '@/lib/api';
import { useCatalog } from '@/hooks/useCatalog';
import { emptyTranslated, type Category, type Product } from '@/lib/types';
import { Badge, Card, ConfirmDelete, ImageUpload, Modal, PageHeader, TranslatedInput, slugify, toast } from './ui';

const blank = (): Product => ({
  id: uid(), slug: '', category_id: null, reference: '', name: emptyTranslated(), description: emptyTranslated(),
  specs: [], image_url: null, featured: false, published: true, created_at: new Date().toISOString(),
});

export default function ProductsAdmin() {
  const { refresh } = useCatalog();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([api.listProducts({ includeUnpublished: true }), api.listCategories()]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const n = q.toLowerCase();
    return products.filter((p) => (!cat || p.category_id === cat) && (!n || [p.reference, p.slug, ...Object.values(p.name)].join(' ').toLowerCase().includes(n)));
  }, [products, q, cat]);

  const remove = async (id: string) => {
    try {
      await api.deleteProduct(id);
      toast('Produit supprimé');
      await Promise.all([load(), refresh()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    }
  };

  return (
    <>
      <PageHeader title="Produits" subtitle={`${products.length} produit(s) au catalogue`}
        actions={<button className="btn btn-red !min-h-[42px]" onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> Ajouter un produit</button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-navy/10 p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <input className="field !min-h-[42px] !pl-10 !py-2" placeholder="Rechercher par nom, référence…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
          </label>
          <select className="field !min-h-[42px] !py-2 sm:!w-64" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name.fr}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-mist text-[11px] uppercase tracking-wider text-navy/60">
              <tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-mist/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 shrink-0 overflow-hidden bg-mist">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
                      <div className="min-w-0"><p className="truncate font-semibold text-navy">{p.name.fr || p.name.en}</p><p className="truncate text-xs text-navy/45">/{p.slug}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                  <td className="px-4 py-3 text-navy/70">{categories.find((c) => c.id === p.category_id)?.name.fr ?? '—'}</td>
                  <td className="px-4 py-3"><div className="flex gap-1.5">{p.published ? <Badge tone="green">Publié</Badge> : <Badge tone="gray">Brouillon</Badge>}{p.featured && <Badge tone="red">Vedette</Badge>}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <a href={`/products/${p.slug}`} target="_blank" rel="noreferrer" className="flex h-9 w-9 items-center justify-center text-navy/50 hover:text-navy" title="Voir"><Eye className="h-4 w-4" /></a>
                      <button className="flex h-9 w-9 items-center justify-center text-navy/50 hover:text-navy" title="Modifier" aria-label="Modifier" onClick={() => setEditing(structuredClone(p))}><Pencil className="h-4 w-4" /></button>
                      <ConfirmDelete onConfirm={() => remove(p.id)} />
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-navy/50">Aucun produit.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && (
        <ProductEditor product={editing} categories={categories} existing={products} onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await Promise.all([load(), refresh()]); }} />
      )}
    </>
  );
}

function ProductEditor({ product, categories, existing, onClose, onSaved }: {
  product: Product; categories: Category[]; existing: Product[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [p, setP] = useState<Product>(product);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !existing.some((x) => x.id === product.id);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const slug = p.slug || slugify(p.name.fr || p.name.en);
    if (!p.name.fr.trim()) return setError('Le nom (FR) est obligatoire.');
    if (!p.reference.trim()) return setError('La référence est obligatoire.');
    if (!slug) return setError("L'identifiant d'URL est invalide.");
    if (existing.some((x) => x.slug === slug && x.id !== p.id)) return setError('Cet identifiant d’URL est déjà utilisé.');
    setBusy(true);
    setError(null);
    try {
      await api.saveProduct({ ...p, slug, specs: p.specs.filter((s) => s.label.fr.trim() || s.value.fr.trim()) });
      toast(isNew ? 'Produit ajouté' : 'Produit mis à jour');
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open wide title={isNew ? 'Nouveau produit' : 'Modifier le produit'} onClose={onClose}
      footer={<>
        {error && <p className="mr-auto self-center text-sm text-brand-red">{error}</p>}
        <button className="btn btn-ghost !min-h-[42px]" onClick={onClose}>Annuler</button>
        <button className="btn btn-red !min-h-[42px]" disabled={busy} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</button>
      </>}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <TranslatedInput label="Nom" required value={p.name} onChange={(v) => setP((s) => ({ ...s, name: v, slug: isNew && !s.slug ? '' : s.slug }))} />
          <TranslatedInput label="Description" multiline value={p.description} onChange={(v) => set('description', v)} />
        </div>
        <div className="space-y-5">
          <ImageUpload value={p.image_url} onChange={(v) => set('image_url', v)} folder="products" label="Image du produit" />
          <div className="grid grid-cols-2 gap-4">
            <div><label className="field-label" htmlFor="p-ref">Référence *</label><input id="p-ref" className="field font-mono" value={p.reference} onChange={(e) => set('reference', e.target.value)} /></div>
            <div><label className="field-label" htmlFor="p-slug">URL (slug)</label><input id="p-slug" className="field" placeholder={slugify(p.name.fr) || 'auto'} value={p.slug} onChange={(e) => set('slug', slugify(e.target.value))} /></div>
          </div>
          <div>
            <label className="field-label" htmlFor="p-cat">Catégorie</label>
            <select id="p-cat" className="field" value={p.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
              <option value="">— Aucune —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name.fr}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-navy" checked={p.published} onChange={(e) => set('published', e.target.checked)} /> Publié</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-red" checked={p.featured} onChange={(e) => set('featured', e.target.checked)} /><Star className="h-3.5 w-3.5" /> Mis en avant (accueil)</label>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-navy/10 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="field-label !mb-0">Caractéristiques techniques</h3>
          <button className="btn btn-ghost !min-h-[36px] !px-3 !text-[11px]" onClick={() => set('specs', [...p.specs, { label: emptyTranslated(), value: emptyTranslated() }])}><Plus className="h-3.5 w-3.5" /> Ajouter</button>
        </div>
        <div className="mt-4 space-y-4">
          {p.specs.map((s, i) => (
            <div key={i} className="relative grid gap-3 bg-mist p-4 pr-12 md:grid-cols-2">
              <TranslatedInput label={`Libellé ${i + 1}`} value={s.label} onChange={(v) => set('specs', p.specs.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
              <TranslatedInput label={`Valeur ${i + 1}`} value={s.value} onChange={(v) => set('specs', p.specs.map((x, j) => (j === i ? { ...x, value: v } : x)))} />
              <button className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center text-navy/50 hover:text-brand-red" aria-label="Retirer" onClick={() => set('specs', p.specs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </div>
          ))}
          {!p.specs.length && <p className="text-sm text-navy/50">Aucune caractéristique.</p>}
        </div>
      </div>
    </Modal>
  );
}
