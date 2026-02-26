'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Ripple } from 'primereact/ripple';
import { useTheme } from '@/providers/ThemeProvider';
import { DASHBOARD_LIST } from '@/constants/DASHBOARD_LIST';
import styles from './HomePage.module.scss';

const UnicornIcon = () => (
  <span style={{ display: 'inline-flex', width: '1.5rem', height: '1.5rem' }}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    >
      <path d="M38.355 25.079c1.205 1.61 4.46 4.554 4.12 11.067m-23.889-9.963s9.021 5.536 2.079 14.481m-5.242-28.296L5.5 7.336l7.446 8.345" />
      <path d="M22.503 20.367c.374 5.695-6.354 6.613-8.148 7.044c-.227.054-.43.17-.595.335l-1.515 1.515a1.27 1.27 0 0 1-.898.372H8.953c-.82 0-1.548-.525-1.807-1.303l-.362-1.085a1.9 1.9 0 0 1 .174-1.583l5.988-9.98l3.22-3.22l-1.442-4.707s5.318-.476 5.735 3.634c0 0 11.537 1.664 7.192 13.21c0 0-1.107 4.055 1.619 7.624" />
      <path d="M19.586 8.883s15.16-2.74 13.603 13.603" />
      <path d="M32.537 15.109s10.064 4.49 3.719 15.144c0 0-3.664 4.473.426 9.273" />
      <circle cx="15.156" cy="19.045" r="1.363" />
    </svg>
  </span>
);

export const HomePage = () => {
  const { theme, cycleTheme } = useTheme();
  const router = useRouter();
  const enabled = DASHBOARD_LIST.filter((d) => d.enabled);

  return (
    <div className={styles.container}>
      <Image src="/cpt-logo.webp" alt="CPT" width={120} height={120} className={styles.logo} priority />

      <div className={styles.grid}>
        {enabled.map((d) => (
          <div
            key={d.route}
            className={`${styles.tile} ${d.variant === 'unicorn' ? styles.tileUnicorn : ''} p-ripple`}
            onClick={() => router.push(d.route)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && router.push(d.route)}
          >
            <Ripple />
            {d.variant === 'unicorn' ? (
              <span className={styles.tileIcon}><UnicornIcon /></span>
            ) : (
              <i className={`${d.icon} ${styles.tileIcon}`} />
            )}
            <span className={styles.tileTitle}>{d.title}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={cycleTheme}
        className={styles.themeSwitcher}
        title={`Theme: ${theme}`}
      >
        {theme}
      </button>
    </div>
  );
};
