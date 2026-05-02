@AGENTS.md

## Git
- Do not add Co-Authored-By trailers or "Generated with Claude Code" lines to commits or PR descriptions. I author all commits.

# Stack

- Next.js 16.2 (App Router, RSC) + React 19.2 + TypeScript 5
- Tailwind CSS v4 (PostCSS plugin, no `tailwind.config.*` — theme lives in `app/globals.css` via `@theme inline`)
- shadcn v4 (style `base-nova`, neutral base color, CSS variables) — config in `components.json`
- Base UI (`@base-ui/react`) for headless primitives; `lucide-react` for icons
- `bun` for install / lockfile (`bun.lock`); npm scripts still run via `next` CLI

# Layout

- `app/` — routes, `layout.tsx` wires Geist + Inter fonts and `cn()` from `@/lib/utils`
- `components/ui/` — shadcn-generated primitives (alias `@/components/ui`)
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- Path alias: `@/*` → repo root (see `tsconfig.json`)

# Commands

- `bun run dev` — next dev
- `bun run build` — next build
- `bun run lint` — eslint (flat config in `eslint.config.mjs`)

# Adding shadcn components

The shadcn MCP server is configured in `.mcp.json`. Use it (or `bunx shadcn@latest add <item>`) to add components — they land in `components/ui/` per `components.json` aliases. Do not hand-write shadcn primitives.

# Styling notes

- Tailwind v4: import is `@import "tailwindcss"` in `app/globals.css`; no config file
- Theme tokens are CSS vars in `:root` / `.dark` and surfaced to Tailwind via `@theme inline`
- Dark mode uses `@custom-variant dark (&:is(.dark *))` — toggle by adding `dark` class on an ancestor
