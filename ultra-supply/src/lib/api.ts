import { supabase } from './supabase';
import type {
  Category, ContactInput, ContactMessage, ContentRow, Partner, Product, QuoteInput, QuoteRequest, QuoteStatus,
} from './types';
import { seedCategories, seedPartners, seedProducts } from '@/data/seed';

export interface AdminSession { email: string }

export interface Api {
  mode: 'supabase' | 'demo';
  // Public
  listCategories(): Promise<Category[]>;
  listProducts(opts?: { includeUnpublished?: boolean }): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  listPartners(opts?: { includeUnpublished?: boolean }): Promise<Partner[]>;
  listContent(): Promise<ContentRow[]>;
  submitQuote(input: QuoteInput, file?: File | null): Promise<void>;
  submitContact(input: ContactInput): Promise<void>;
  // Auth
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<AdminSession | null>;
  isAdmin(): Promise<boolean>;
  onAuthChange(cb: () => void): () => void;
  // Admin
  saveProduct(p: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  savePartner(p: Partner): Promise<void>;
  deletePartner(id: string): Promise<void>;
  listQuotes(): Promise<QuoteRequest[]>;
  updateQuoteStatus(id: string, status: QuoteStatus): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  getAttachmentUrl(path: string): Promise<string | null>;
  listMessages(): Promise<ContactMessage[]>;
  setMessageRead(id: string, read: boolean): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  saveContent(rows: ContentRow[]): Promise<void>;
  deleteContent(key: string): Promise<void>;
  uploadImage(file: File, folder: string): Promise<string>;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const safeName = (name: string) =>
  name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80).toLowerCase();

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
function supabaseApi(sb: NonNullable<typeof supabase>): Api {
  const check = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  const productCols =
    'id,slug,category_id,reference,name,description,specs,image_url,featured,published,created_at';

  return {
    mode: 'supabase',
    async listCategories() {
      return check(await sb.from('categories').select('*').order('sort_order')) as Category[];
    },
    async listProducts(opts) {
      let q = sb.from('products').select(productCols).order('created_at', { ascending: true });
      if (!opts?.includeUnpublished) q = q.eq('published', true);
      return check(await q) as Product[];
    },
    async getProduct(slug) {
      const res = await sb.from('products').select(productCols).eq('slug', slug).maybeSingle();
      return check(res) as Product | null;
    },
    async listPartners(opts) {
      let q = sb.from('partners').select('*').order('sort_order');
      if (!opts?.includeUnpublished) q = q.eq('published', true);
      return check(await q) as Partner[];
    },
    async listContent() {
      return check(await sb.from('site_content').select('key,fr,en,ar')) as ContentRow[];
    },
    async submitQuote(input, file) {
      let attachment_path: string | null = null;
      if (file) {
        const path = `incoming/${uid()}-${safeName(file.name)}`;
        check(await sb.storage.from('quote-attachments').upload(path, file, { contentType: file.type }));
        attachment_path = path;
      }
      // No .select() — visitors are not allowed to read quote rows back (RLS).
      check(await sb.from('quote_requests').insert({ ...input, attachment_path, status: 'new' }));
    },
    async submitContact(input) {
      check(await sb.from('contact_messages').insert({ ...input, is_read: false }));
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async getSession() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ? { email: data.session.user.email ?? '' } : null;
    },
    async isAdmin() {
      const { data, error } = await sb.rpc('is_admin');
      return !error && data === true;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },
    async saveProduct(p) {
      check(await sb.from('products').upsert(p));
    },
    async deleteProduct(id) {
      check(await sb.from('products').delete().eq('id', id));
    },
    async saveCategory(c) {
      check(await sb.from('categories').upsert(c));
    },
    async deleteCategory(id) {
      check(await sb.from('categories').delete().eq('id', id));
    },
    async savePartner(p) {
      check(await sb.from('partners').upsert(p));
    },
    async deletePartner(id) {
      check(await sb.from('partners').delete().eq('id', id));
    },
    async listQuotes() {
      return check(await sb.from('quote_requests').select('*').order('created_at', { ascending: false })) as QuoteRequest[];
    },
    async updateQuoteStatus(id, status) {
      check(await sb.from('quote_requests').update({ status }).eq('id', id));
    },
    async deleteQuote(id) {
      const row = check(await sb.from('quote_requests').select('attachment_path').eq('id', id).maybeSingle()) as
        | { attachment_path: string | null }
        | null;
      if (row?.attachment_path) await sb.storage.from('quote-attachments').remove([row.attachment_path]);
      check(await sb.from('quote_requests').delete().eq('id', id));
    },
    async getAttachmentUrl(path) {
      const { data } = await sb.storage.from('quote-attachments').createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    },
    async listMessages() {
      return check(await sb.from('contact_messages').select('*').order('created_at', { ascending: false })) as ContactMessage[];
    },
    async setMessageRead(id, read) {
      check(await sb.from('contact_messages').update({ is_read: read }).eq('id', id));
    },
    async deleteMessage(id) {
      check(await sb.from('contact_messages').delete().eq('id', id));
    },
    async saveContent(rows) {
      check(await sb.from('site_content').upsert(rows));
    },
    async deleteContent(key) {
      check(await sb.from('site_content').delete().eq('key', key));
    },
    async uploadImage(file, folder) {
      const path = `${folder}/${uid()}-${safeName(file.name)}`;
      check(await sb.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false }));
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    },
  };
}

// ---------------------------------------------------------------------------
// Local demo implementation (browser storage) — used when Supabase is not configured.
// ---------------------------------------------------------------------------
interface DemoDb {
  categories: Category[];
  products: Product[];
  partners: Partner[];
  content: ContentRow[];
  quotes: QuoteRequest[];
  messages: ContactMessage[];
}

const DB_KEY = 'ultra-supply-demo-db-v1';
const SESSION_KEY = 'ultra-supply-demo-session';
export const DEMO_CREDENTIALS = { email: 'admin@demo.local', password: 'ultrasupply-demo' };

function demoApi(): Api {
  const listeners = new Set<() => void>();
  const fresh = (): DemoDb => ({
    categories: structuredClone(seedCategories),
    products: structuredClone(seedProducts),
    partners: structuredClone(seedPartners),
    content: [],
    quotes: [],
    messages: [],
  });
  let mem: DemoDb | null = null;
  const load = (): DemoDb => {
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(DB_KEY);
      mem = raw ? (JSON.parse(raw) as DemoDb) : fresh();
    } catch {
      mem = fresh();
    }
    return mem;
  };
  const save = (db: DemoDb) => {
    mem = db;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* storage full or unavailable: keep in memory */
    }
  };
  const tick = () => new Promise((r) => setTimeout(r, 250));
  const authed = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === DEMO_CREDENTIALS.email;
    } catch {
      return false;
    }
  };
  const guard = () => {
    if (!authed()) throw new Error('Not authorized');
  };
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  };
  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  return {
    mode: 'demo',
    async listCategories() {
      return [...load().categories].sort((a, b) => a.sort_order - b.sort_order);
    },
    async listProducts(opts) {
      return load().products.filter((p) => opts?.includeUnpublished || p.published);
    },
    async getProduct(slug) {
      return load().products.find((p) => p.slug === slug && (p.published || authed())) ?? null;
    },
    async listPartners(opts) {
      return [...load().partners]
        .filter((p) => opts?.includeUnpublished || p.published)
        .sort((a, b) => a.sort_order - b.sort_order);
    },
    async listContent() {
      return load().content;
    },
    async submitQuote(input, file) {
      await tick();
      const db = load();
      let attachment_path: string | null = null;
      if (file) attachment_path = file.size < 1_500_000 ? await toDataUrl(file) : `demo:${file.name}`;
      db.quotes.unshift({ ...input, id: uid(), attachment_path, status: 'new', created_at: new Date().toISOString() });
      save(db);
    },
    async submitContact(input) {
      await tick();
      const db = load();
      db.messages.unshift({ ...input, id: uid(), is_read: false, created_at: new Date().toISOString() });
      save(db);
    },
    async signIn(email, password) {
      await tick();
      if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password)
        throw new Error('Invalid login credentials');
      sessionStorage.setItem(SESSION_KEY, DEMO_CREDENTIALS.email);
      listeners.forEach((l) => l());
    },
    async signOut() {
      sessionStorage.removeItem(SESSION_KEY);
      listeners.forEach((l) => l());
    },
    async getSession() {
      return authed() ? { email: DEMO_CREDENTIALS.email } : null;
    },
    async isAdmin() {
      return authed();
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async saveProduct(p) {
      guard();
      const db = load();
      if (db.products.some((x) => x.slug === p.slug && x.id !== p.id)) throw new Error('Slug already used');
      upsert(db.products, p);
      save(db);
    },
    async deleteProduct(id) {
      guard();
      const db = load();
      db.products = db.products.filter((p) => p.id !== id);
      save(db);
    },
    async saveCategory(c) {
      guard();
      const db = load();
      if (db.categories.some((x) => x.slug === c.slug && x.id !== c.id)) throw new Error('Slug already used');
      upsert(db.categories, c);
      save(db);
    },
    async deleteCategory(id) {
      guard();
      const db = load();
      db.categories = db.categories.filter((c) => c.id !== id);
      db.products = db.products.map((p) => (p.category_id === id ? { ...p, category_id: null } : p));
      save(db);
    },
    async savePartner(p) {
      guard();
      const db = load();
      upsert(db.partners, p);
      save(db);
    },
    async deletePartner(id) {
      guard();
      const db = load();
      db.partners = db.partners.filter((p) => p.id !== id);
      save(db);
    },
    async listQuotes() {
      guard();
      return load().quotes;
    },
    async updateQuoteStatus(id, status) {
      guard();
      const db = load();
      db.quotes = db.quotes.map((q) => (q.id === id ? { ...q, status } : q));
      save(db);
    },
    async deleteQuote(id) {
      guard();
      const db = load();
      db.quotes = db.quotes.filter((q) => q.id !== id);
      save(db);
    },
    async getAttachmentUrl(path) {
      return path.startsWith('data:') ? path : null;
    },
    async listMessages() {
      guard();
      return load().messages;
    },
    async setMessageRead(id, read) {
      guard();
      const db = load();
      db.messages = db.messages.map((m) => (m.id === id ? { ...m, is_read: read } : m));
      save(db);
    },
    async deleteMessage(id) {
      guard();
      const db = load();
      db.messages = db.messages.filter((m) => m.id !== id);
      save(db);
    },
    async saveContent(rows) {
      guard();
      const db = load();
      for (const row of rows) {
        const i = db.content.findIndex((c) => c.key === row.key);
        if (i >= 0) db.content[i] = row;
        else db.content.push(row);
      }
      save(db);
    },
    async deleteContent(key) {
      guard();
      const db = load();
      db.content = db.content.filter((c) => c.key !== key);
      save(db);
    },
    async uploadImage(file) {
      guard();
      if (file.size > 1_500_000) throw new Error('Demo mode: images must be under 1.5 MB');
      return toDataUrl(file);
    },
  };
}

export const api: Api = supabase ? supabaseApi(supabase) : demoApi();
