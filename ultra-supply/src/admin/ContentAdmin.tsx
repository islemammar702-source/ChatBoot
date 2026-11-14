import { useMemo, useState } from 'react';
import { Loader2, RotateCcw, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { dictionaries, SETTINGS_KEYS, useI18n } from '@/i18n';
import type { DictKey } from '@/i18n/fr';
import type { ContentRow, Locale } from '@/lib/types';
import { Badge, Card, PageHeader, toast } from './ui';

const GROUPS: Record<string, string> = {
  nav: 'Navigation', common: 'Commun', brand: 'Marque', hero: 'Accueil — Hero', intro: 'Accueil — Présentation',
  sectors: 'Secteurs', products: 'Produits', import: 'Import & Distribution', why: 'Pourquoi nous', partners: 'Partenaires',
  cta: 'Appel à l’action', quote: 'Formulaire de devis', form: 'Validation des formulaires', contact: 'Contact',
  about: 'À propos', industries: 'Page Secteurs', footer: 'Pied de page', notFound: 'Page 404', seo: 'SEO (méta-descriptions)',
};
const LOCALES: Locale[] = ['fr', 'en', 'ar'];
const SETTING_LABELS: Partial<Record<DictKey, string>> = {
  'contact.phoneValue': 'Téléphone', 'contact.whatsappValue': 'WhatsApp', 'contact.emailValue': 'E-mail professionnel',
  'contact.mapQuery': 'Adresse pour Google Maps', 'social.facebook': 'Facebook (URL)', 'social.linkedin': 'LinkedIn (URL)',
  'social.instagram': 'Instagram (URL)', 'social.youtube': 'YouTube (URL)',
};

export default function ContentAdmin() {
  const { overrides, refreshContent } = useI18n();
  const [tab, setTab] = useState<'settings' | 'texts'>('settings');
  const [draft, setDraft] = useState<Record<string, ContentRow>>({});
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);

  const allKeys = Object.keys(dictionaries.fr) as DictKey[];
  const settingsSet = new Set<string>(SETTINGS_KEYS);
  const textKeys = allKeys.filter((k) => !settingsSet.has(k));

  const current = (k: string): ContentRow => draft[k] ?? overrides[k] ?? { key: k, fr: '', en: '', ar: '' };
  const edit = (k: string, l: Locale, v: string) => setDraft((d) => ({ ...d, [k]: { ...current(k), [l]: v } }));
  const dirty = Object.keys(draft).length;

  const visible = useMemo(() => {
    const n = q.toLowerCase();
    return textKeys.filter((k) => (!group || k.startsWith(group + '.')) && (!n || k.includes(n) || LOCALES.some((l) => (dictionaries[l][k] + ' ' + (overrides[k]?.[l] ?? '')).toLowerCase().includes(n))));
  }, [q, group, overrides]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const rows = Object.values(draft);
      // Settings keys share one value across languages.
      const normalized = rows.map((r) => (settingsSet.has(r.key) ? { ...r, en: r.fr, ar: r.fr } : r));
      await api.saveContent(normalized);
      await refreshContent();
      setDraft({});
      toast(`${rows.length} contenu(s) enregistré(s)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    } finally {
      setBusy(false);
    }
  };

  const reset = async (k: string) => {
    await api.deleteContent(k);
    setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
    await refreshContent();
    toast('Texte réinitialisé');
  };

  return (
    <>
      <PageHeader title="Contenu & traductions" subtitle="Modifiez les textes du site en français, anglais et arabe. Un champ vide utilise le texte par défaut."
        actions={<button className="btn btn-red !min-h-[42px]" disabled={!dirty || busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer {dirty ? `(${dirty})` : ''}</button>} />

      <div className="mb-6 flex gap-1">
        {([['settings', 'Coordonnées & réseaux sociaux'], ['texts', 'Textes du site']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`min-h-[42px] px-5 text-sm font-semibold ${tab === id ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy-100'}`}>{label}</button>
        ))}
      </div>

      {tab === 'settings' ? (
        <Card className="p-6">
          <p className="mb-6 text-sm text-navy/60">N'indiquez que des coordonnées réelles. Tant qu'un champ reste vide, le site affiche un texte de remplacement.</p>
          <div className="grid gap-5 md:grid-cols-2">
            {SETTINGS_KEYS.map((k) => (
              <div key={k}>
                <label className="field-label" htmlFor={`s-${k}`}>{SETTING_LABELS[k] ?? k}</label>
                <input id={`s-${k}`} className="field" placeholder={dictionaries.fr[k] || '—'} value={current(k).fr} onChange={(e) => edit(k, 'fr', e.target.value)} />
              </div>
            ))}
            <div className="md:col-span-2">
              <span className="field-label">Adresse affichée</span>
              <div className="grid gap-2 md:grid-cols-3">
                {LOCALES.map((l) => (
                  <input key={l} aria-label={`Adresse ${l}`} dir={l === 'ar' ? 'rtl' : 'ltr'} className="field" placeholder={`${l.toUpperCase()} — ${dictionaries[l]['contact.addressValue']}`} value={current('contact.addressValue')[l]} onChange={(e) => edit('contact.addressValue', l, e.target.value)} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
              <input className="field !min-h-[42px] !py-2 !pl-10" placeholder="Rechercher un texte…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
            </label>
            <select className="field !min-h-[42px] !py-2 sm:!w-72" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Section">
              <option value="">Toutes les sections</option>
              {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {visible.map((k) => {
              const row = current(k);
              const modified = Boolean(overrides[k]);
              const long = dictionaries.fr[k].length > 70;
              return (
                <Card key={k} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-navy/50">{k}</code>
                      <Badge tone="gray">{GROUPS[k.split('.')[0]] ?? k.split('.')[0]}</Badge>
                      {modified && <Badge tone="red">Modifié</Badge>}
                      {draft[k] && <Badge tone="navy">Non enregistré</Badge>}
                    </div>
                    {modified && <button className="flex items-center gap-1 text-xs text-navy/50 hover:text-brand-red" onClick={() => void reset(k)}><RotateCcw className="h-3.5 w-3.5" /> Par défaut</button>}
                  </div>
                  <div className="grid gap-2 lg:grid-cols-3">
                    {LOCALES.map((l) => {
                      const props = {
                        'aria-label': `${k} ${l}`, dir: l === 'ar' ? 'rtl' : 'ltr', lang: l,
                        className: `field !min-h-[42px] !py-2 text-sm ${l === 'ar' ? 'font-arabic' : ''}`,
                        placeholder: dictionaries[l][k], value: row[l],
                        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => edit(k, l, e.target.value),
                      } as const;
                      return (
                        <div key={l} className="relative">
                          <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-navy/40">{l.toUpperCase()}</span>
                          {long ? <textarea rows={3} {...props} /> : <input {...props} />}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
