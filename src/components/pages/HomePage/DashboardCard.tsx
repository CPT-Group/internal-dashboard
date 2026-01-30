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
}

export const DashboardCard = ({ title, description, route, icon }: DashboardCardProps) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(route);
  };

  const iconClass = icon || 'pi pi-th-large';

  return (
    <Card className="dashboard-card h-full cursor-pointer" onClick={handleClick}>
      <div className="p-ripple flex flex-column align-items-center justify-content-center gap-2 h-full">
        <Ripple />
        <i className={`${iconClass} text-5xl text-primary`} />
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
