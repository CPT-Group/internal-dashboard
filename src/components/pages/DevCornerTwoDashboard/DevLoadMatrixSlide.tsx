'use client';

import { useMemo } from 'react';
import { Card } from 'primereact/card';
import type { DevLoadMatrixCell } from '@/types';
import styles from './DevCornerTwoDashboard.module.scss';

export interface DevLoadMatrixSlideProps {
  matrix: DevLoadMatrixCell[];
  assignees: string[];
  components: string[];
}

export const DevLoadMatrixSlide = ({ matrix, assignees, components }: DevLoadMatrixSlideProps) => {
  const maxLoad = useMemo(
    () => Math.max(1, ...matrix.map((c) => c.count)),
    [matrix]
  );

  const nameByAssignee = useMemo(() => {
    const map = new Map<string, string>();
    matrix.forEach((c) => map.set(c.assigneeId, c.assigneeName));
    return map;
  }, [matrix]);

  const visibleComponents = components.slice(0, 10);
  const visibleAssignees = assignees.slice(0, 12);

  return (
    <div className={styles.slideContent}>
      <div className={styles.slideTitle}>
        <span>Developer Load Matrix</span>
      </div>
      <Card className="flex-1 flex flex-column min-h-0">
        <div className={styles.matrixWrap}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Dev / Component</th>
                {visibleComponents.map((c) => (
                  <th key={c} style={{ textAlign: 'center' }}>
                    {c.length > 10 ? c.slice(0, 8) + '…' : c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleAssignees.map((aid) => {
                const name = nameByAssignee.get(aid) ?? aid;
                return (
                  <tr key={aid}>
                    <td className={styles.matrixName}>{name.split(' ')[0]}</td>
                    {visibleComponents.map((comp) => {
                      const cell = matrix.find((c) => c.assigneeId === aid && c.component === comp);
                      const count = cell?.count ?? 0;
                      const intensity = maxLoad > 0 ? count / maxLoad : 0;
                      const bg = `rgba(59, 130, 246, ${0.15 + intensity * 0.75})`;
                      return (
                        <td key={comp} style={{ textAlign: 'center', backgroundColor: bg }}>
                          {count || '–'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
