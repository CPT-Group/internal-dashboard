'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Password } from 'primereact/password';

import styles from '@/components/pages/CursorAnalyticsDashboard/CursorAnalyticsDashboard.module.scss';

function CursorAnalyticsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/cursor-analytics';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cursor-analytics/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        setError(body.message ?? 'Login failed.');
        return;
      }
      router.replace(nextPath.startsWith('/cursor-analytics') ? nextPath : '/cursor-analytics');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }, [nextPath, password, router]);

  return (
    <main className={styles.root} aria-label="Cursor analytics login">
      <div className={styles.loginShell}>
        <h1 className={styles.loginTitle}>Cursor analytics</h1>
        <p className={styles.loginHint}>Team password required.</p>
        <form
          className={styles.loginForm}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className={styles.loginLabel} htmlFor="cursor-analytics-password">
            Password
          </label>
          <Password
            id="cursor-analytics-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            feedback={false}
            toggleMask
            inputClassName="w-full"
            className={styles.loginPassword}
            autoComplete="current-password"
          />
          {error ? <Message severity="error" text={error} className="w-full" /> : null}
          <Button type="submit" label="Continue" loading={submitting} disabled={submitting || password.length === 0} />
        </form>
      </div>
    </main>
  );
}

export default function CursorAnalyticsLoginPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.root} aria-label="Cursor analytics login">
          <div className={styles.loginShell}>
            <InputText disabled placeholder="Loading…" className="w-full" />
          </div>
        </main>
      }
    >
      <CursorAnalyticsLoginForm />
    </Suspense>
  );
}
