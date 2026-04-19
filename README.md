# Data Marketplace Hub

A full-stack data marketplace platform where sellers list and monetise datasets, and buyers browse, request access, and purchase data — built with React, TypeScript, Vite, and Supabase.

## Features

### For Buyers
- Browse and search published datasets by category and price
- Request access to listings and track request status
- Purchase datasets by record count with time-limited download links (24-hour expiry)
- Notifications on access approvals and declines

### For Sellers
- Create, edit, publish, and archive dataset listings
- Set per-record pricing, upload sample previews, and track file metadata
- Approve or decline buyer access requests
- View and manage all incoming requests from a unified dashboard

### For Admins
- Platform overview with live metrics (users, listings, waitlist)
- Manage waitlist entries (waiting → invited → converted)
- Moderate all listings across the platform
- Assign and manage user roles (admin / moderator / user)

### Platform
- Public marketplace with search and category filtering
- Waitlist with role preference capture (buyer / seller / both)
- Onboarding flow for new users (display name, company, primary role)
- Audit log, error capture, and outbound email queue built into the schema

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Auth | Lovable Cloud Auth |
| Testing | Vitest, Testing Library |

## Data Model

| Table | Purpose |
|---|---|
| `profiles` | User profile — display name, company, role, onboarding status |
| `listings` | Datasets for sale — pricing, category, file metadata, status lifecycle |
| `access_requests` | Buyer→seller access negotiation (pending / approved / declined) |
| `purchases` | Transaction records with payment status and file delivery info |
| `notifications` | Per-user notifications with read tracking |
| `waitlist` | Pre-launch signups with role preference and invite tracking |
| `user_roles` | Role assignments (admin / moderator / user) |
| `audit_log` | Immutable action log across all entities |
| `outbound_emails` | Email send queue with status and error tracking |
| `captured_errors` | Runtime error log with context and resolution status |

Row-level security (RLS) is enforced on all tables. Users see only their own data; admins bypass via a `has_role()` policy helper.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project

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

## Routes

| Path | Access | Description |
|---|---|---|
| `/` | Public | Landing page with waitlist signup |
| `/auth` | Public | Sign in / sign up |
| `/marketplace` | Public | Browse published listings |
| `/marketplace/:id` | Public | Listing detail and purchase |
| `/onboarding` | Authenticated | First-time profile setup |
| `/dashboard` | Authenticated | Buyer/seller hub with stats |
| `/dashboard/listings` | Authenticated | Manage your listings |
| `/dashboard/listings/new` | Authenticated | Create a listing |
| `/dashboard/listings/:id/edit` | Authenticated | Edit a listing |
| `/dashboard/requests` | Authenticated | Manage access requests |
| `/dashboard/purchases` | Authenticated | View purchased datasets |
| `/dashboard/notifications` | Authenticated | Notification inbox |
| `/dashboard/settings` | Authenticated | Profile settings |
| `/admin` | Admin only | Platform metrics overview |
| `/admin/waitlist` | Admin only | Manage waitlist entries |
| `/admin/listings` | Admin only | Moderate all listings |
| `/admin/users` | Admin only | Manage user roles |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 8080) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run preview` | Preview production build |

## Environment Variables

Copy `.env.example` to `.env` and set the following. For CI, add them as GitHub Actions secrets.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

## CI

GitHub Actions runs lint, tests, and build on every push and pull request. See `.github/workflows/ci.yml`.
