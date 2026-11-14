export type Locale = 'fr' | 'en' | 'ar';
export type Translated = Record<Locale, string>;

export interface Category {
  id: string;
  slug: string;
  name: Translated;
  description: Translated;
  image_url: string | null;
  sort_order: number;
}

export interface ProductSpec {
  label: Translated;
  value: Translated;
}

export interface Product {
  id: string;
  slug: string;
  category_id: string | null;
  reference: string;
  name: Translated;
  description: Translated;
  specs: ProductSpec[];
  image_url: string | null;
  featured: boolean;
  published: boolean;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  sort_order: number;
  published: boolean;
}

export interface ContentRow {
  key: string;
  fr: string;
  en: string;
  ar: string;
}

export type QuoteStatus = 'new' | 'in_progress' | 'answered' | 'archived';

export interface QuoteInput {
  full_name: string;
  company: string;
  email: string;
  phone: string;
  product: string;
  reference: string;
  quantity: number;
  message: string;
  locale: Locale;
}

export interface QuoteRequest extends QuoteInput {
  id: string;
  attachment_path: string | null;
  status: QuoteStatus;
  created_at: string;
}

export interface ContactInput {
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

export interface ContactMessage extends ContactInput {
  id: string;
  is_read: boolean;
  created_at: string;
}

export const emptyTranslated = (): Translated => ({ fr: '', en: '', ar: '' });
