import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from '@/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'CPT Group Internal',
  description: 'CPT Group Internal Dashboard',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <link
          id="theme-stylesheet"
          rel="stylesheet"
          href="/themes/cpt-legacy-dark/theme.css"
        />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cpt-theme') || 'dark';
                  var link = document.getElementById('theme-stylesheet');
                  if (link) {
                    link.href = theme === 'light' 
                      ? '/themes/cpt-legacy-light/theme.css'
                      : '/themes/cpt-legacy-dark/theme.css';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
