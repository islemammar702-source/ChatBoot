import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/i18n';
import { NAV } from '@/lib/routes';

export function Header() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = pathname === '/' && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        overHero ? 'bg-transparent' : 'border-b border-navy/10 bg-white/95 shadow-[0_8px_30px_-20px_rgba(10,36,69,0.35)] backdrop-blur'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-navy">
        {t('nav.skip')}
      </a>
      <div className={`container-site flex items-center justify-between gap-6 transition-all duration-500 ${scrolled ? 'h-[72px]' : 'h-[88px]'}`}>
        <Link to="/" aria-label="ULTRA SUPPLY — Home" className="shrink-0">
          <Logo variant={overHero ? 'light' : 'dark'} />
        </Link>

        <nav aria-label="Main" className="hidden min-[1360px]:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `group relative block whitespace-nowrap px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      overHero ? 'text-white/85 hover:text-white' : 'text-navy/80 hover:text-navy'
                    } ${isActive ? (overHero ? '!text-white' : '!text-navy') : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {t(item.key)}
                      <span
                        className={`absolute inset-x-3 -bottom-0.5 h-[2px] origin-left bg-brand-red transition-transform duration-300 rtl:origin-right ${
                          isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <LanguageSwitcher tone={overHero ? 'light' : 'dark'} className="hidden sm:flex" />
          <Link to="/quote" className="btn btn-red hidden !min-h-[44px] !px-5 !tracking-[0.12em] md:inline-flex">
            {t('nav.quote')}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </Link>
          <button
            type="button"
            className={`flex h-11 w-11 items-center justify-center min-[1360px]:hidden ${overHero ? 'text-white' : 'text-navy'}`}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t('nav.close') : t('nav.menu')}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-nav"
        className={`fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-white transition-all duration-500 min-[1360px]:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        } ${scrolled ? 'top-[72px]' : 'top-[88px]'}`}
      >
        <nav aria-label="Mobile" className="container-site flex min-h-full flex-col py-8">
          <ul className="divide-y divide-navy/10 border-y border-navy/10">
            {NAV.map((item, i) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-between py-5 font-display text-2xl font-bold uppercase ${isActive ? 'text-brand-red' : 'text-navy'}`
                  }
                >
                  <span>{t(item.key)}</span>
                  <span className="text-xs font-medium text-navy/40">0{i + 1}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-6">
            <Link to="/quote" className="btn btn-red w-full">
              {t('nav.quote')}
            </Link>
            <LanguageSwitcher className="justify-center" />
          </div>
        </nav>
      </div>
    </header>
  );
}
