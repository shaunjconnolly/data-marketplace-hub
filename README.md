# Data Marketplace Hub

A data marketplace platform built with React, TypeScript, Vite, and Supabase.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **Backend**: Supabase (auth + database)
- **State**: TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Auth**: Lovable Cloud Auth

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/shaunjconnolly/data-marketplace-hub.git
   cd data-marketplace-hub
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:8080`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run preview` | Preview production build |

## Environment Variables

See `.env.example` for required variables. Set these as GitHub Actions secrets for CI:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

## CI

GitHub Actions runs lint, tests, and build on every push and pull request. See `.github/workflows/ci.yml`.
