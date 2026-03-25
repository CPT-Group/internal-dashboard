'use client';

import { useMemo } from 'react';
import { Card } from 'primereact/card';
import type { DevLoadMatrixCell } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerTwoDashboard.module.scss';

export interface DevLoadMatrixSlideProps {
  matrix: DevLoadMatrixCell[];
  assignees: string[];
  components: string[];
}

export const DevLoadMatrixSlide = ({ matrix, assignees, components }: DevLoadMatrixSlideProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 10, pauseMs: 4000 });

  const maxLoad = useMemo(
    () => Math.max(1, ...matrix.map((c) => c.count)),
    [matrix]
  );

  const nameByAssignee = useMemo(() => {
    const map = new Map<string, string>();
    matrix.forEach((c) => map.set(c.assigneeId, c.assigneeName));
    return map;
  }, [matrix]);

  const cellByAssigneeAndComponent = useMemo(() => {
    const m = new Map<string, number>();
    matrix.forEach((c) => m.set(`${c.assigneeId}|${c.component}`, c.count));
    return m;
  }, [matrix]);

  /** Rows = components (Y); columns = devs (X). */
  const visibleComponents = components.slice(0, 16);
  const visibleAssignees = assignees.slice(0, 12);

  const cellBg = (count: number) => {
    const intensity = maxLoad > 0 ? count / maxLoad : 0;
    const pct = Math.round(12 + intensity * 78);
    return `color-mix(in srgb, var(--primary-color) ${pct}%, transparent)`;
  };

  return (
    <div className={styles.slideContent}>
      <div className={styles.slideTitle}>
        <span>Developer Load Matrix</span>
      </div>
      <Card className={styles.tableCard}>
        <div ref={scrollRef} className={styles.tableScrollWrap}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th className={styles.matrixCorner}>Component</th>
                {visibleAssignees.map((aid) => {
                  const name = nameByAssignee.get(aid) ?? aid;
                  return (
                    <th key={aid} className={styles.matrixColHead}>
                      {name.split(' ')[0]}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleComponents.map((comp) => (
                <tr key={comp}>
                  <td className={styles.matrixName}>
                    {comp.length > 14 ? comp.slice(0, 12) + '…' : comp}
                  </td>
                  {visibleAssignees.map((aid) => {
                    const count = cellByAssigneeAndComponent.get(`${aid}|${comp}`) ?? 0;
                    return (
                      <td key={aid} className={styles.matrixCell} style={{ background: cellBg(count) }}>
                        {count || '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
