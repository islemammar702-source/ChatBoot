import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { I18nProvider } from './i18n';
import { CatalogProvider } from './hooks/useCatalog';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <I18nProvider>
          <CatalogProvider>
            <App />
          </CatalogProvider>
        </I18nProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
);
