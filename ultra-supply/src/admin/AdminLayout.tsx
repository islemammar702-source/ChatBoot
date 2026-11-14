import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ExternalLink, FileText, FolderTree, Handshake, LayoutDashboard, Languages, LogOut, Mail, Menu, Package, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from './auth';
import { Toaster } from './ui';
import { api } from '@/lib/api';

const LINKS = [
  { to: '/admin', label: 'Tableau de bord', Icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Produits', Icon: Package },
  { to: '/admin/categories', label: 'Catégories', Icon: FolderTree },
  { to: '/admin/partners', label: 'Marques & partenaires', Icon: Handshake },
  { to: '/admin/quotes', label: 'Demandes de devis', Icon: FileText },
  { to: '/admin/messages', label: 'Messages', Icon: Mail },
  { to: '/admin/content', label: 'Contenu & traductions', Icon: Languages },
];

export default function AdminLayout() {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Administration">
      {LINKS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end}
          className={({ isActive }) => `flex items-center gap-3 px-4 py-3 text-[14px] font-medium transition-colors ${isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#D92332]' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
          <Icon className="h-4 w-4" strokeWidth={1.6} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div dir="ltr" lang="fr" className="min-h-screen bg-mist font-sans text-navy-950">
      <Helmet>
        <html lang="fr" dir="ltr" />
        <title>Administration | ULTRA SUPPLY</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy-950 text-white transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link to="/admin"><Logo variant="light" withTagline={false} /></Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
        </div>
        {nav}
        <div className="border-t border-white/10 p-4 text-sm">
          {api.mode === 'demo' && <p className="mb-3 bg-brand-red/20 px-3 py-2 text-[12px] text-white/80">Mode démo : données stockées dans ce navigateur. Configurez Supabase pour la production.</p>}
          <p className="truncate px-2 text-white/50">{session?.email}</p>
          <div className="mt-3 flex gap-2">
            <Link to="/" target="_blank" className="flex flex-1 items-center justify-center gap-2 border border-white/15 py-2.5 text-white/70 hover:text-white"><ExternalLink className="h-4 w-4" /> Site</Link>
            <button onClick={() => void signOut()} className="flex flex-1 items-center justify-center gap-2 border border-white/15 py-2.5 text-white/70 hover:border-brand-red hover:text-white"><LogOut className="h-4 w-4" /> Sortir</button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-navy/10 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="flex h-10 w-10 items-center justify-center"><Menu className="h-5 w-5" /></button>
          <Logo withTagline={false} />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
