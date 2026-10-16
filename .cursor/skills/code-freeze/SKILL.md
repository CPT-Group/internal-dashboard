---
name: code-freeze
description: >-
  Enables or disables Dev Corner Code Freeze TV mode by flipping
  CODE_FREEZE_ENABLED in src/constants/CODE_FREEZE.ts, updating CHANGELOG,
  committing, and pushing to main so Netlify deploys the TVs. Use when the
  user invokes /code-freeze, asks to turn code freeze on/off, or mentions
  enabling the frost/CODE FREEZE overlay on Dev Corner One/Two.
---

# Code Freeze (Dev Corner TVs)

Single source of truth: `src/constants/CODE_FREEZE.ts` → `CODE_FREEZE_ENABLED`.

When `true`, **Dev Corner One and Two only** get `CodeFreezeOverlay` (frost theme + periodic full-screen CODE FREEZE notice). Other TV rooms are unchanged. No env/UI toggle — source flag + deploy.

## Default on invoke

**If the user does not say off/disable/end:** treat as **enable** (`true`).

| User says | Action |
|-----------|--------|
| `/code-freeze`, “enable code freeze”, “turn on freeze”, “code freeze on” | `CODE_FREEZE_ENABLED = true` |
| “disable code freeze”, “code freeze off”, “end freeze”, “lift freeze” | `CODE_FREEZE_ENABLED = false` |

Do **not** ask for confirmation. Flip → changelog → commit → **push `main`**.

## Workflow (always)

1. Confirm current branch is `main` (or checkout `main` and pull). Working tree should be clean of unrelated dirty files; restore prebuild noise (`*.generated.ts`, `cursor-analytics-summary.json`) if present.
2. Edit **only** `src/constants/CODE_FREEZE.ts`:

```ts
export const CODE_FREEZE_ENABLED = true;  // or false
```

Leave notice interval/duration/message constants alone unless the user asks.

3. Update `CHANGELOG.md` under `[Unreleased]` → **Changed**:

- Enable: `**Code Freeze ON**: \`CODE_FREEZE_ENABLED = true\` — Dev Corner One/Two frost theme + periodic notice.`
- Disable: `**Code Freeze OFF**: \`CODE_FREEZE_ENABLED = false\` — Dev Corner One/Two frost theme + periodic notice disabled.`

4. Commit **only** the flag + changelog (and this skill if you just added/edited it in the same turn):

```text
chore(tv): enable Code Freeze on Dev Corner TVs
```

or

```text
chore(tv): disable Code Freeze on Dev Corner TVs
```

5. **Push to `origin main`** immediately (`git push origin main`). Netlify production deploy picks it up; TVs hard-reload on their normal interval.

6. Verify locally (optional quick check): `rg "CODE_FREEZE_ENABLED" src/constants/CODE_FREEZE.ts` shows the intended boolean. After deploy, spot-check `https://cpt-tv.netlify.app/tv/dev-corner-one` for frost theme when enabled.

## Scope / safety

- **Do not** change theme SCSS, overlay components, or notice timing unless asked.
- **Do not** enable freeze on other rooms (Trevor, conference, Jackie, Julie, GitHub activity).
- **Do not** put the flag behind env vars in this skill’s path — keep the boolean in source.
- Never commit `.env.local` or secrets.
- If push is rejected / Netlify secrets scan fails, fix that first (same as any main deploy), then re-push.

## Reference

- Flag: `src/constants/CODE_FREEZE.ts`
- Overlay: `src/components/ui/CodeFreezeOverlay/`
- Wiring: `src/components/pages/TVDashboard/TVDashboard.tsx` (gated by `CODE_FREEZE_ENABLED`)
- Docs: `AGENTS.md` → Code Freeze bullet
