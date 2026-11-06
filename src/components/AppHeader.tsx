'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppHeader({
  leadsCount = 10,
  debriefsCount = 3,
}: {
  leadsCount?: number;
  debriefsCount?: number;
}) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('pond-theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('pond-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('pond-theme', 'light');
    }
  };

  const navItems = [
    { href: '/', label: 'Morning Leads', badge: leadsCount },
    { href: '/debrief', label: 'Call Debriefs', badge: debriefsCount },
    { href: '/crm', label: 'CRM Sheet' },
    { href: '/spec', label: 'Rules & n8n Export' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-surface)]/90 backdrop-blur border-b border-[var(--border-color)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-main)] rounded-md"
        >
          <span
            translate="no"
            className="size-7 rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] flex items-center justify-center font-bold text-xs shrink-0"
          >
            P
          </span>
          <span translate="no" className="font-semibold text-sm tracking-tight whitespace-nowrap">
            Pond Signal Desk
          </span>
        </Link>

        <nav aria-label="Main Navigation" className="flex items-center gap-1 overflow-x-auto py-1">
          {navItems.map(item => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-main)] ${
                  active
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {item.label}
                {typeof item.badge === 'number' ? (
                  <span className="ml-1.5 text-[var(--text-muted)] tabular">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="size-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-main)] cursor-pointer press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-main)]"
          >
            {isDark ? (
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="m4.93 4.93 1.41 1.41"></path>
                <path d="m17.66 17.66 1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="m6.34 17.66-1.41 1.41"></path>
                <path d="m19.07 4.93-1.41 1.41"></path>
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
