import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Work around a known Next.js 16 + React 19 framework bug where the built-in
  // `/_global-error` and `/_not-found` pages fail static prerender with
  //   "TypeError: Cannot read properties of null (reading 'useContext')"
  // when the root layout uses any `'use client'` provider tree. The error
  // originates in Next's own compiled chunks, not in our code; Vercel has
  // acknowledged the class of issue (see vercel/next.js#84994 and related).
  //
  // `experimental.prerenderEarlyExit: false` lets Next demote a failing
  // prerender to dynamic rendering instead of aborting the whole build - the
  // same behaviour you get from `next build --debug-prerender`. At runtime the
  // page simply SSRs on demand, which is fine for an error/404 page.
  experimental: {
    prerenderEarlyExit: false,
  },
};

export default nextConfig;
