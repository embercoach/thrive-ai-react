# Thrive AI

Personal finance coaching app. React + TypeScript + Vite + Tailwind CSS v4.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_ANON_KEY in .env.local with your real anon key
npm run dev
```

## Build

```bash
npm run build   # outputs to dist/
```

Deploys to Vercel with zero config — it auto-detects Vite and runs `npm run build`.
Set the same env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel
project settings, not just locally.

## Architecture

- `src/components/ui` — Card, Button, ProgressRing, ProgressBar, Modal, Input, CardHeader
- `src/components/charts` — Sparkline, DonutChart
- `src/components/transactions` — TransactionRow, BillRow
- `src/components/goals` — FeaturedGoalCard, CompactGoalRow
- `src/components/ai` — chat bubbles, PromptCard, BreakdownCard
- `src/components/layout` — BottomNav, TopBar
- `src/pages` — one file per route
- `src/hooks` — useAuth, useAppData (the shared data context), useHomeMetrics
- `src/services` — supabase.ts (client) and api.ts (all Supabase queries, kept
  separate from React so they're testable independently)
- `src/lib` — currency formatting, category to icon/color mapping, cn() helper
- `src/utils/dates.ts` — timezone-safe date parsing, month-end-safe recurring
  date advancement (both ported from real bugs fixed in the original app)
- `src/styles/globals.css` — the entire design token system as a Tailwind v4
  @theme block. Every color/radius/shadow/font is declared once here and
  becomes real Tailwind utilities (bg-brand, text-ink-secondary, etc.)

## Status

Home is fully wired to real Supabase data. Spending, Goals, AI, and Profile
are routed but still placeholder pages -- same build-it-for-real approach
comes next for each one.

Not yet ported from the original app: onboarding, the tutorial system,
Paddle/billing, the AI chat backend integration, CSV export, currency
switching UI, budget/recurring management modals.
