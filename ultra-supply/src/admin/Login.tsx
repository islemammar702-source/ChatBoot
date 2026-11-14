import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Img } from '@/components/Img';
import { useAuth } from './auth';
import { api, DEMO_CREDENTIALS } from '@/lib/api';
import { images } from '@/data/images';

export default function Login() {
  const { session, isAdmin, loading, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string; denied?: boolean } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(location.state?.denied ? "Ce compte n'a pas les droits d'administration." : null);

  if (!loading && session && isAdmin) return <Navigate to={location.state?.from ?? '/admin'} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Veuillez saisir votre e-mail et votre mot de passe.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      if (!(await api.isAdmin())) {
        await signOut();
        setError("Ce compte n'a pas les droits d'administration.");
        return;
      }
      navigate(location.state?.from ?? '/admin', { replace: true });
    } catch {
      setError('Identifiants incorrects.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="ltr" lang="fr" className="grid min-h-screen bg-white lg:grid-cols-2">
      <Helmet>
        <html lang="fr" dir="ltr" />
        <title>Connexion administration | ULTRA SUPPLY</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <Img src={images.warehouse} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 to-navy/40" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <span className="eyebrow">Administration</span>
          <p className="display-lg mt-5">Ultra Supply<span className="text-brand-red">.</span></p>
          <p className="mt-4 text-white/60">Gestion du catalogue, des demandes de devis et du contenu du site.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="mx-auto w-full max-w-md">
          <Logo />
          <h1 className="mt-12 font-display text-3xl font-extrabold uppercase text-navy">Connexion</h1>
          <p className="mt-2 text-navy/60">Espace réservé aux administrateurs.</p>

          {api.mode === 'demo' && (
            <div className="mt-6 border-l-[3px] border-brand-red bg-mist p-4 text-[13px] text-navy/80">
              <strong>Mode démo</strong> (Supabase non configuré). Identifiants :<br />
              <code className="font-mono">{DEMO_CREDENTIALS.email}</code> / <code className="font-mono">{DEMO_CREDENTIALS.password}</code>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="field-label">E-mail</label>
              <input id="email" type="email" autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="field-label">Mot de passe</label>
              <input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="field-error">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-navy w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Se connecter
            </button>
          </form>
          <Link to="/" className="btn-link mt-10"><ArrowLeft className="h-4 w-4" /> Retour au site</Link>
        </div>
      </div>
    </div>
  );
}
