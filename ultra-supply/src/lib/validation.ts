import type { DictKey } from '@/i18n/fr';

export type Errors<T> = Partial<Record<keyof T, DictKey>>;

export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.trim());
export const isPhone = (v: string) => /^[+()\d\s.-]{6,30}$/.test(v.trim()) && v.replace(/\D/g, '').length >= 6;

export const ACCEPTED_FILES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_FILE = 10 * 1024 * 1024;

export function validateFile(file: File | null): DictKey | null {
  if (!file) return null;
  if (!ACCEPTED_FILES.includes(file.type)) return 'form.fileType';
  if (file.size > MAX_FILE) return 'form.fileSize';
  return null;
}
