import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { Category, Partner, Product } from '@/lib/types';

interface CatalogValue {
  categories: Category[];
  products: Product[];
  partners: Partner[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogValue | null>(null);

/** Public catalogue data shared by the whole site (published items only). */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<CatalogValue, 'refresh'>>({
    categories: [], products: [], partners: [], loading: true, error: false,
  });

  const refresh = useCallback(async () => {
    try {
      const [categories, products, partners] = await Promise.all([
        api.listCategories(), api.listProducts(), api.listPartners(),
      ]);
      setState({ categories, products, partners, loading: false, error: false });
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <CatalogContext.Provider value={{ ...state, refresh }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
