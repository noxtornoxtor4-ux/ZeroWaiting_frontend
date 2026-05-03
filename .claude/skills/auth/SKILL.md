---
name: auth
description: 'Use when working with authentication, authorization, guards, roles, Firebase, sign-in, tokens, or role-based access. Triggers: AuthGuard, RoleGuard, authStore, hasMinRole, UserRole, ROLE_HIERARCHY, Firebase, Google OAuth, sign-in, accessToken, refreshToken, JWT.'
metadata:
  author: zerowaiting
  version: '1.0.0'
---

# Authentication & Authorization

## Authentication Flow

- Firebase Google OAuth → backend returns `accessToken` + `refreshToken`
- Tokens stored in `localStorage` (remember-me) or `sessionStorage`
- Token auto-injected via Axios interceptor
- Auto-refresh on 401 with request queue
- Auth state managed by `authStore` — **tokens only, no user data**
- User data always from `crmQueryApi.createGetProfileMeV1()`
- Login route: `/sign-in`

## Firebase Configuration

Firebase credentials are hardcoded in `src/lib/config/firebase.ts`:

- Project: `issyl-kul-cinema`
- Google Auth provider enabled
- Lazy initialization via `getFirebaseAuth()`

## Role Hierarchy

```
CUSTOMER (0) → STAFF (1) → MANAGER (2) → ADMIN (3) → SUPER_ADMIN (4)
```

## hasMinRole()

```ts
import { UserRole } from '@/api/model';
import { hasMinRole } from '@/lib/constants/roles';

hasMinRole('SUPER_ADMIN', UserRole.STAFF); // true
hasMinRole('CUSTOMER', UserRole.MANAGER); // false
```

## Guards

- `AuthGuard.svelte` — checks `$authStore.accessToken`, redirects to `/sign-in`
- `RoleGuard.svelte` — checks role via `crmQueryApi.createGetProfileMeV1()`, hides content or redirects
