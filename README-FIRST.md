# ClientFlow — Module 1 Foundation

This ZIP contains the full Module 1 starter code for ClientFlow.

## What is already included

- pnpm monorepo
- Next.js + TypeScript frontend
- Tailwind CSS design tokens
- shadcn-style UI primitives stored in source
- `/design-system` component reference page
- Express + TypeScript API
- strict MVC/service/repository folders
- Zod environment validation
- Prisma 7 configuration
- initial multi-tenant schema
- Supabase Prisma-user SQL helper
- health endpoint that checks PostgreSQL
- 404 + global error middleware
- `PROGRESS.md`

## What is intentionally NOT inside the ZIP

- `node_modules` — install locally with pnpm
- `.env` secrets — never commit secrets
- generated Prisma Client — generated after `pnpm install`
- Prisma migration files — create these against your Supabase database
- Supabase account/project — you must create this yourself

## 1. Copy this project into your blank GitHub repository

If your cloned blank repository folder is, for example:

```text
C:\Projects\ClientFlow
```

copy the CONTENTS of this folder into it.

Do not put this folder inside your repo as another nested folder unless you want that.

## 2. Install Node.js 24 LTS

Check:

```powershell
node -v
```

Expected:

```text
v24.x.x
```

## 3. Install pnpm

```powershell
npm install -g pnpm
```

Check:

```powershell
pnpm -v
```

## 4. Install all dependencies

Run from the project root:

```powershell
pnpm install
```

## 5. Create your Supabase project

Create one development project.

Do NOT send your database password to ChatGPT.

Then open Supabase SQL Editor and use:

```text
supabase/prisma-user.sql
```

Replace the placeholder password before executing it.

## 6. Configure backend environment

Copy:

```text
apps/api/.env.example
```

to:

```text
apps/api/.env
```

Fill in your real Supabase Session Pooler URL.

Example shape:

```text
postgresql://prisma.PROJECT_REF:YOUR_PASSWORD@YOUR_REGION.pooler.supabase.com:5432/postgres
```

## 7. Configure frontend environment

Copy:

```text
apps/web/.env.local.example
```

to:

```text
apps/web/.env.local
```

For local development it can stay:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## 8. Generate Prisma Client

From the project root:

```powershell
pnpm --filter @clientflow/api prisma:generate
```

## 9. Create the foundation migration

```powershell
pnpm --filter @clientflow/api prisma:migrate -- --name foundation
```

Then regenerate:

```powershell
pnpm --filter @clientflow/api prisma:generate
```

## 10. Start ClientFlow

Terminal 1:

```powershell
pnpm dev:api
```

Terminal 2:

```powershell
pnpm dev:web
```

## 11. Verify Module 1

Frontend:

```text
http://localhost:3000/design-system
```

Backend:

```text
http://localhost:4000/api/v1/health
```

Expected backend result:

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "service": "clientflow-api",
    "timestamp": "..."
  }
}
```

404 check:

```text
http://localhost:4000/api/v1/banana
```

Expected:

```json
{
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "Cannot GET /api/v1/banana"
  }
}
```

Finally:

```powershell
pnpm typecheck
pnpm build
```

When all four checks pass, Module 1 is complete.

## Architecture rule

Keep controllers thin:

```text
route -> controller -> service -> repository -> Prisma -> PostgreSQL
```

- Routes map URLs to controllers.
- Controllers handle HTTP request/response.
- Services hold business rules.
- Repositories hold database queries.
- Prisma is database access, not controller logic.
