import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from '@/providers';
// Order matters: PrimeReact theme first, then our overrides so dark-synth wins
import 'primereact/resources/themes/lara-dark-blue/theme.css';
import './main.scss';

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
    <html lang="en" suppressHydrationWarning data-theme="dark-synth">
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  /* Keep in sync with src/constants/appThemeCycle.ts (APP_THEME_CYCLE_ORDER). */
                  var valid = ['light', 'dark', 'atlas-light', 'atlas-blue', 'khaki', 'light-synth', 'dark-synth', 'ms-access-2010', 'miami-vice', 'cpt-barbie', 'dark-barbie', 'floral', 'night-vision', 'summer', 'github-dark', 'github-light', 'frostbyte', 'embercore', 'abyss', 'tempest', 'midas', 'aurora', 'evergreen', 'maple', 'bloom', 'espresso', 'moonstone', 'rosegold', 'cpt-cyberpunk', 'nightfang', 'neon-district', 'macaron', 'arcane', 'cpt-vault', 'biohack', 'hearth', 'tundra', 'cpt-paperwork', 'colorblind-red-light', 'colorblind-red-dark', 'colorblind-green-light', 'colorblind-green-dark', 'colorblind-blue-yellow-light', 'colorblind-blue-yellow-dark', 'colorblind-mono-light', 'colorblind-mono-dark'];
                  var stored = localStorage.getItem('cpt-theme');
                  var theme = (stored && valid.indexOf(stored) >= 0) ? stored : 'dark-synth';
                  document.documentElement.setAttribute('data-theme', theme);
                  if (stored !== theme) { localStorage.setItem('cpt-theme', theme); }
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
