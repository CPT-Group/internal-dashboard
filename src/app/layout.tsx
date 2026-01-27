import type { Metadata } from 'next';
import { Providers } from '@/providers';
import { ThemeLink } from '@/components/common';

// Import PrimeReact core styles
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

import './globals.css';

export const metadata: Metadata = {
  title: 'Internal Dashboard',
  description: 'Internal TV dashboard application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeLink />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
