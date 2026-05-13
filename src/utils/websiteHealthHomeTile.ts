/**
 * Whether the Website Health card appears on the home page (`/`).
 *
 * - **Development** (`next dev`, e.g. port 3333): shown so local testing keeps a one-click entry.
 * - **Production** (e.g. Netlify): hidden so internal DB tooling is not advertised on the public home grid.
 *
 * Override: set `NEXT_PUBLIC_WEBSITE_HEALTH_HOME=1` (or `true` / `yes`) in the deploy env to show the tile there.
 */
export function isWebsiteHealthHomeTileVisible(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  const raw = process.env.NEXT_PUBLIC_WEBSITE_HEALTH_HOME?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
