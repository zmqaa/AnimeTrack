"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { navigationItems } from '@/lib/config';
import { useTheme } from '@/components/theme/ThemeProvider';

interface TopNavProps {
  children: React.ReactNode;
}

type SessionUser = { role?: string };

export default function TopNav({ children }: TopNavProps) {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, themes } = useTheme();
  const nextTheme = themes[(themes.findIndex((t) => t.value === theme) + 1) % themes.length];

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isAuthenticated = status === 'authenticated';
  const isAdmin = (session?.user as SessionUser | undefined)?.role === 'admin';

  const visibleItems = navigationItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const isActive = (href: string) => {
    // Only highlight the most specific matching nav item,
    // so /anime/seasons doesn't also light up /anime
    const matchingItems = visibleItems.filter((item) => {
      if (item.href === '/') return pathname === '/';
      return pathname === item.href || pathname.startsWith(item.href + '/');
    });

    if (matchingItems.length === 0) return false;

    // Pick the longest (most specific) match
    matchingItems.sort((a, b) => b.href.length - a.href.length);
    return matchingItems[0].href === href;
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const response = await signOut({ redirect: false, callbackUrl: '/login' });
      const targetUrl = response?.url || '/login';
      router.replace(targetUrl);
      router.refresh();
      window.location.assign(targetUrl);
    } catch {
      setIsSigningOut(false);
    }
  };

  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-page)]">
      {/* ── Top navigation bar ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-page)]/95">
        <div className="flex h-16 items-center px-6">
          {/* Left spacer */}
          <div className="flex-1" />

          {/* Desktop nav links — centered */}
          <nav className="hidden md:flex items-center gap-1.5">
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-base rounded-lg transition-colors ${
                    active
                      ? 'text-[var(--text-primary)] bg-[var(--tag-bg)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex-1 flex items-center justify-end gap-3">
            {/* Theme cycle button */}
            <button
              onClick={() => setTheme(nextTheme.value)}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] transition-colors"
              aria-label={`切换主题：${nextTheme.label}`}
              title={`切换到${nextTheme.label}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>

            {isAuthenticated && (
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="hidden md:inline-flex text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                {isSigningOut ? '退出中...' : '退出'}
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] transition-colors"
              aria-label="菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-[var(--border)] bg-[var(--bg-page)]">
            <div className="px-4 py-3 space-y-1">
              {visibleItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-base transition-colors ${
                      active
                        ? 'text-[var(--text-primary)] bg-[var(--tag-bg)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full text-left px-4 py-3 rounded-lg text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] transition-colors disabled:opacity-50"
                >
                  {isSigningOut ? '退出中...' : '退出登录'}
                </button>
              )}
              <button
                onClick={() => {
                  setTheme(nextTheme.value);
                  setMobileOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] transition-colors"
              >
                切换主题：{nextTheme.label}
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
