# ZeroWaiting Frontend

Global SaaS platform for cinema chain management — built with SvelteKit 2 and Svelte 5.

## Tech Stack

- **Framework** — SvelteKit 2 (Svelte 5 runes)
- **Styling** — SCSS (scoped) + CSS custom properties
- **Server State** — TanStack Svelte Query
- **API Client** — Axios + Orval (auto-generated from OpenAPI)
- **Auth** — Firebase Google OAuth + JWT
- **i18n** — svelte-i18n (ru, en, ky, kz, uz)
- **Build** — Vite 7, TypeScript strict mode

## Prerequisites

- [Bun](https://bun.sh/) (runtime & package manager)
- Node.js 24+ (for Docker builds)

## Getting Started

```sh
# Install dependencies
bun install

# Generate API client from OpenAPI spec
bun run generate:api

# Start dev server
bun run dev
```

## Scripts

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `bun run dev`          | Start dev server                        |
| `bun run build`        | Production build                        |
| `bun run preview`      | Preview production build                |
| `bun run check`        | TypeScript + Svelte type checking       |
| `bun run check:watch`  | Continuous type checking                |
| `bun run format`       | Prettier formatting                     |
| `bun run generate:api` | Regenerate API client from OpenAPI spec |

## Environment Variables

| Variable            | Description          | Default                         |
| ------------------- | -------------------- | ------------------------------- |
| `VITE_API_BASE_URL` | Backend API endpoint | `https://api-zerowaiting.elcho.dev` |

## Docker Deployment

```sh
# Build the image
docker build -t zerowaiting-frontend .

# Run the container
docker run -d \
  --name zerowaiting-frontend \
  -p 80:80 \
  --restart unless-stopped \
  zerowaiting-frontend
```

### System Requirements

**Minimum**: 1 vCPU, 512 MB RAM, 2 GB disk
**Recommended**: 2 vCPU, 1 GB RAM, 5 GB disk

## Project Structure

```
src/
  api/
    endpoints/         # Auto-generated API modules (Orval) — DO NOT edit
    model/             # Auto-generated TypeScript types — DO NOT edit
    mutator/           # Axios instance + interceptors + auto-refresh
  components/
    ui/                # Reusable UI components (Button, Input, Modal, etc.)
    client/layout/     # Client layout (Header, Footer, etc.)
    admin/layout/      # Admin layout (Sidebar, Shell, etc.)
    admin/shared/      # Admin shared (CrudTable, CrudModal)
  lib/
    config/            # Firebase, navigation config
    constants/         # Roles, booking statuses, seat types
    guards/            # AuthGuard, RoleGuard
    i18n/              # Locale setup + 5 JSON locale files
    stores/            # Auth tokens, sidebar, booking flow, seat selection
    utils/             # i18n-field, date, price formatters
  routes/
    (auth)/            # Sign-in (Google OAuth)
    (client)/          # Public + client pages (movies, screenings, booking, profile)
    admin/             # Admin panel (dashboard, CRUD pages, analytics)
```
