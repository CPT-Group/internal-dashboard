import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from '@/providers';
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
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cpt-theme') || 'dark';
                  var linkId = 'theme-stylesheet';
                  var existingLink = document.getElementById(linkId);
                  
                  if (!existingLink) {
                    var link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    link.media = 'all';
                    var themePath = theme === 'light' 
                      ? '/themes/cpt-legacy-light/theme.css'
                      : '/themes/cpt-legacy-dark/theme.css';
                    link.href = themePath;
                    document.head.insertBefore(link, document.head.firstChild);
                  } else {
                    var themePath = theme === 'light' 
                      ? '/themes/cpt-legacy-light/theme.css'
                      : '/themes/cpt-legacy-dark/theme.css';
                    existingLink.href = themePath;
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
