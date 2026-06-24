'use client';

import { useMsal } from '@azure/msal-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';

import styles from '@/components/pages/CursorAnalyticsDashboard/CursorAnalyticsDashboard.module.scss';
import { getEntraClientConfig } from '@/lib/entraConfig';
import { getCursorAnalyticsLoginScopes } from '@/lib/cursorAnalyticsMsalConfig';
import { CursorAnalyticsMsalProvider } from '@/providers/CursorAnalyticsMsalProvider';

function errorMessage(code: string | null): string | null {
  switch (code) {
    case 'misconfigured':
      return 'Cursor analytics Entra auth is not configured on this host. Access is denied (fail closed).';
    case 'forbidden':
      return 'You are signed in but do not have dashboard.cursorAnalytics.view permission.';
    default:
      return null;
  }
}

function CursorAnalyticsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/cursor-analytics';
  const urlError = errorMessage(searchParams.get('error'));

  const { instance, accounts } = useMsal();
  const entraConfigured = getEntraClientConfig() !== null;

  const [error, setError] = useState<string | null>(urlError);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const completeLogin = useCallback(
    async (accessToken: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/cursor-analytics/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        const body = (await res.json()) as { message?: string };
        if (!res.ok) {
          setError(body.message ?? 'Sign-in failed.');
          return;
        }
        router.replace(nextPath.startsWith('/cursor-analytics') ? nextPath : '/cursor-analytics');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sign-in failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [nextPath, router],
  );

  const signInWithMicrosoft = useCallback(async () => {
    if (!entraConfigured) {
      setError('Entra auth is not configured on this host.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const scopes = getCursorAnalyticsLoginScopes();
      const active = instance.getActiveAccount() ?? accounts[0] ?? null;
      if (active) {
        instance.setActiveAccount(active);
        const silent = await instance.acquireTokenSilent({ scopes, account: active });
        await completeLogin(silent.accessToken);
        return;
      }
      await instance.loginRedirect({ scopes });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setSubmitting(false);
    }
  }, [accounts, completeLogin, entraConfigured, instance]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap(): Promise<void> {
      if (!entraConfigured) {
        setBootstrapping(false);
        return;
      }
      try {
        const result = await instance.handleRedirectPromise();
        const account = result?.account ?? instance.getActiveAccount() ?? accounts[0] ?? null;
        if (account) {
          instance.setActiveAccount(account);
          const scopes = getCursorAnalyticsLoginScopes();
          const tokenResult = result?.accessToken
            ? result
            : await instance.acquireTokenSilent({ scopes, account });
          if (!cancelled && tokenResult.accessToken) {
            await completeLogin(tokenResult.accessToken);
            return;
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Sign-in failed.');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [accounts, completeLogin, entraConfigured, instance]);

  return (
    <main className={styles.root} aria-label="Cursor analytics login">
      <div className={styles.loginShell}>
        <h1 className={styles.loginTitle}>Cursor analytics</h1>
        <p className={styles.loginHint}>Sign in with your CPT Microsoft account.</p>
        {!entraConfigured ? (
          <Message
            severity="warn"
            text="Entra auth is not configured. This route is locked (fail closed)."
            className="w-full"
          />
        ) : null}
        {error ? <Message severity="error" text={error} className="w-full" /> : null}
        <Button
          type="button"
          label={bootstrapping ? 'Checking session…' : 'Sign in with Microsoft'}
          loading={submitting || bootstrapping}
          disabled={!entraConfigured || submitting || bootstrapping}
          onClick={() => {
            void signInWithMicrosoft();
          }}
        />
      </div>
    </main>
  );
}

export default function CursorAnalyticsLoginPage() {
  return (
    <CursorAnalyticsMsalProvider>
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
    </CursorAnalyticsMsalProvider>
  );
}
