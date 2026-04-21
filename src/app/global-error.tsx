'use client';

// Per Next.js docs, global-error replaces the root layout when React's error
// boundary catches an error thrown from the root layout itself. It must define
// its own <html>/<body> and cannot use any of our client-side providers (they
// are not mounted at this boundary). Keep it minimal + fully self-contained.
//
// This file also works around a known Next.js 16 + React 19 prerender bug where
// the built-in default global-error page fails SSR with "Cannot read properties
// of null (reading 'useContext')" when the root layout wraps children in any
// `'use client'` provider. See:
//   https://github.com/vercel/next.js/issues/84994
// Providing our own self-contained client component + opting into dynamic
// rendering sidesteps that and lets `next build` complete.
export const dynamic = 'force-dynamic';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '3rem 1.5rem',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Helvetica Neue, sans-serif',
          background: '#0d0d10',
          color: '#f2f2f2',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 640, width: '100%' }}>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.75rem' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 1.25rem', opacity: 0.85 }}>
            The dashboard hit an unrecoverable error. Try reloading; if it persists, let the dev team know.
          </p>
          {error?.digest ? (
            <p style={{ margin: '0 0 1.25rem', opacity: 0.6, fontSize: '0.875rem' }}>
              Error reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.65rem 1.1rem',
              fontSize: '1rem',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
