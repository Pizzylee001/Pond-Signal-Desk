import type { Metadata } from 'next';
import { Lexend, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pond Signal Desk · Warm Signal SDR & Deal Debrief',
  description:
    'Daily X and LinkedIn buying-signal scorer, human-approved opener drafter, and 2-pass sales call debrief studio built for Pond AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lexend.variable} ${sourceSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="antialiased min-h-screen flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-[var(--btn-primary-bg)] focus:text-[var(--btn-primary-fg)] text-xs font-medium"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
