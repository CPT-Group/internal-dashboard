'use client';

import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Ripple } from 'primereact/ripple';
import { useRouter } from 'next/navigation';

interface DashboardCardProps {
  title: string;
  description: string;
  route: string;
  icon: string;
  variant?: 'unicorn';
}

/** Local unicorn SVG (from emoji-unicorn.svg); stroke uses currentColor so theme applies. */
function UnicornIcon({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', width: '3rem', height: '3rem' }}>
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
}

export const DashboardCard = ({ title, description, route, icon, variant }: DashboardCardProps) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(route);
  };

  const iconClass = icon || 'pi pi-th-large';
  const cardClass = ['dashboard-card', 'h-full', 'cursor-pointer', variant === 'unicorn' && 'dashboard-card-unicorn']
    .filter(Boolean)
    .join(' ');

  const iconEl =
    variant === 'unicorn' ? (
      <UnicornIcon className="text-primary" />
    ) : (
      <i className={`${iconClass} text-5xl text-primary`} />
    );

  return (
    <Card className={cardClass} onClick={handleClick}>
      <div className="p-ripple flex flex-column align-items-center justify-content-center gap-2 h-full">
        <Ripple />
        {iconEl}
        <h2 className="text-2xl font-bold m-0 text-center">{title}</h2>
        {description && (
          <p className="text-base text-center text-color-secondary m-0">{description}</p>
        )}
        <Button
          label="View Dashboard"
          icon="pi pi-arrow-right"
          iconPos="right"
          className="mt-1"
          size="large"
          raised
        />
      </div>
    </Card>
  );
};
