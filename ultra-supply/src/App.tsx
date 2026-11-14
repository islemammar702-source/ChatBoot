import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import Home from '@/pages/Home';
import { AuthProvider, RequireAdmin } from '@/admin/auth';

const Products = lazy(() => import('@/pages/Products'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Industries = lazy(() => import('@/pages/Industries'));
const ImportDistribution = lazy(() => import('@/pages/ImportDistribution'));
const About = lazy(() => import('@/pages/About'));
const Partners = lazy(() => import('@/pages/Partners'));
const Contact = lazy(() => import('@/pages/Contact'));
const Quote = lazy(() => import('@/pages/Quote'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const Login = lazy(() => import('@/admin/Login'));
const Dashboard = lazy(() => import('@/admin/Dashboard'));
const ProductsAdmin = lazy(() => import('@/admin/ProductsAdmin'));
const CategoriesAdmin = lazy(() => import('@/admin/CategoriesAdmin'));
const PartnersAdmin = lazy(() => import('@/admin/PartnersAdmin'));
const QuotesAdmin = lazy(() => import('@/admin/QuotesAdmin'));
const MessagesAdmin = lazy(() => import('@/admin/MessagesAdmin'));
const ContentAdmin = lazy(() => import('@/admin/ContentAdmin'));

function Fallback() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-navy" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:slug" element={<ProductDetail />} />
            <Route path="industries" element={<Industries />} />
            <Route path="import-distribution" element={<ImportDistribution />} />
            <Route path="about" element={<About />} />
            <Route path="partners" element={<Partners />} />
            <Route path="contact" element={<Contact />} />
            <Route path="quote" element={<Quote />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="partners" element={<PartnersAdmin />} />
            <Route path="quotes" element={<QuotesAdmin />} />
            <Route path="messages" element={<MessagesAdmin />} />
            <Route path="content" element={<ContentAdmin />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
