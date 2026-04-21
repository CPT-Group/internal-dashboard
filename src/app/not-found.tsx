// 404 page rendered inside the root layout. The layout wraps children in a
// `'use client'` Providers tree (ThemeProvider + PrimeReactProvider), which in
// Next.js 16 + React 19 trips a framework-level prerender bug:
//   TypeError: Cannot read properties of null (reading 'useContext')
// ...when Next tries to statically prerender this page. Opting into dynamic
// rendering sidesteps that without changing runtime behaviour (the 404 page is
// served on demand, never long-cached).
// See: https://github.com/vercel/next.js/issues/84994
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: '2rem', margin: '0 0 0.75rem' }}>404</h1>
        <p style={{ margin: '0 0 1rem', opacity: 0.75 }}>
          We couldn&apos;t find that page.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.55rem 1rem',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            textDecoration: 'none',
          }}
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
