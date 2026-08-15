# ClientFlow Development Progress

## Module 1 â€” Foundations

- [x] Architecture decisions
- [x] Monorepo structure
- [x] pnpm workspace
- [x] Node.js / TypeScript strategy
- [x] Next.js App Router skeleton
- [x] Tailwind CSS
- [x] shadcn-style primitive layer
- [x] ClientFlow design tokens
- [x] Component library / design-system page
- [x] Express API skeleton
- [x] Strict MVC folder structure
- [x] Environment validation
- [x] Prisma configuration
- [x] Prisma schema v1
- [x] Organizations
- [x] Users
- [x] Multi-org memberships
- [x] Role foundation
- [x] Clients
- [x] Projects
- [x] Tasks
- [x] Subtask data model
- [x] Health endpoint
- [x] Global 404 handling
- [x] Global error handling
- [ ] Create Supabase project
- [ ] Add real DATABASE_URL
- [ ] Generate Prisma Client
- [ ] Run foundation migration
- [ ] Confirm Supabase tables
- [ ] Confirm frontend design system
- [ ] Confirm API health endpoint
- [ ] Confirm `pnpm typecheck`
- [ ] Module 1 verification completed

## Module 2 â€” Auth & RBAC

- [ ] Authentication architecture decision
- [ ] Auth.js
- [ ] Credentials login
- [ ] Google OAuth
- [ ] Org-scoped session
- [ ] Organization switching
- [ ] ADMIN permissions
- [ ] MANAGER permissions
- [ ] MEMBER permissions
- [ ] CLIENT permissions
- [ ] Express auth middleware
- [ ] Express RBAC middleware
- [ ] Protected Next.js routes
- [ ] Protected API routes
- [ ] Module 2 verification

## Module 3 â€” CRM

- [ ] Client companies CRUD
- [ ] Contacts CRUD
- [ ] Notes
- [ ] Activity history
- [ ] Search
- [ ] Filters
- [ ] Sorting
- [ ] Pagination

## Module 4 â€” Projects & Tasks

- [ ] Project CRUD
- [ ] Task CRUD
- [ ] Assignees
- [ ] Statuses
- [ ] Priorities
- [ ] Due dates
- [ ] Subtasks
- [ ] List view
- [ ] Kanban view

## Module 5 â€” Files & Comments

- [ ] File storage
- [ ] Project attachments
- [ ] Task attachments
- [ ] Comments
- [ ] Activity feed

## Module 6 — Notifications

- [x] In-app notification inbox
- [x] Unread count, mark-one-read and mark-all-read
- [x] Notification category preferences
- [x] Task assignment/update/workflow notifications
- [x] Project membership notifications
- [x] Comment/reply notifications
- [x] File-share notifications
- [x] Tenant-safe recipient filtering and self-notification suppression
- [x] Resend transactional email integration
- [x] Resend sandbox delivery without a custom domain
- [x] Email delivery state, attempts, provider message ID and idempotency
- [x] Notification bell, inbox, filters, pagination and deep links
- [ ] Scheduled due-date reminder jobs — deferred to Module 9 Background Jobs
- [ ] BullMQ/Redis delivery queue and retry workers — Module 9 Background Jobs

## Module 7 â€” Invoicing

- [x] Invoice builder
- [x] Line items
- [x] Totals
- [x] Invoice numbering
- [x] PDF generation

## Module 8 â€” Stripe

- [x] Stripe test mode
- [x] Checkout
- [x] Webhooks
- [x] Payment status sync

## Module 9 â€” Background Jobs

- [ ] Redis
- [ ] BullMQ
- [ ] PDF jobs
- [ ] Email jobs
- [ ] Webhook jobs
- [ ] Retries
- [ ] Failed jobs

## Module 10 â€” Client Portal

- [ ] Client-only project access
- [ ] Client-only invoice access
- [ ] Payment button

## Module 11 â€” Analytics

- [ ] Revenue
- [ ] Task throughput
- [ ] Overdue invoices
- [ ] Active projects

## Module 12 â€” Deploy & Polish

- [ ] Vercel
- [ ] Render
- [ ] Production Supabase configuration
- [ ] GitHub Actions
- [ ] Seed/demo data
- [ ] Hiring-manager README
- [ ] E2E tests
- [ ] Portfolio launch

## Module 4 - Projects and Tasks [COMPLETE]
Completed: 2026-08-13

### Delivered
- Multi-tenant Projects API using strict Express MVC.
- Client-linked projects with project status, start date, and due date.
- ProjectMember team model with LEAD and MEMBER project roles.
- Custom per-project workflow columns with semantic categories.
- Multi-assignee tasks through TaskAssignee.
- Task priorities, start/due dates, creator tracking, and completion timestamps.
- Nested subtasks.
- Transactional Kanban movement and position ordering.
- Project/task search, filters, sorting, and pagination.
- ADMIN / MANAGER / MEMBER / CLIENT project authorization and tenant isolation.
- Projects dashboard with TanStack Table.
- Project detail workspace with Board and List views.
- Native drag-and-drop Kanban.
- React Hook Form plus shared Zod validation for Module 4 forms.
- Project team management, workflow management, and archive/restore.
- Task create/edit/delete, multi-assignee UI, and quick subtasks.

### Verification
- Prisma schema validation and client generation passed.
- Migration 20260812211500_projects_tasks_workflows applied successfully.
- Database migration status reported up to date.
- Full monorepo TypeScript typecheck passed.
- Consolidated Module 4 backend smoke verification passed.
- Projects dashboard and dynamic project route verified in browser.
- Board/List, task movement, task edit, subtasks, team/workflow dialogs, and archive/restore verified.
- Production build passed.

### Next
Module 5 - Files and Comments
## Module 5 - Files, Comments & Activity

Status: COMPLETE

Delivered:
- Private Supabase Storage integration with 25 MB application file limit.
- Project files, task attachments and comment attachments.
- Signed upload intents, direct private uploads, signed downloads and deletion flow.
- INTERNAL and CLIENT visibility controls.
- Project and task comments with threaded replies.
- Edit-own and soft-delete comment behavior.
- Project/task/comment/file activity events.
- Project workspace Files, Comments and Activity views.
- Task-level Collaboration tabs for Comments, Files and Activity.
- Upload progress, file search, pagination and visibility filters.
- Tenant-aware RBAC and project-access enforcement.

Verified:
- Prisma migration deployed and schema up to date.
- API TypeScript typecheck passed.
- Collaboration API smoke passed.
- Real private Storage upload -> complete -> signed download -> content integrity -> delete smoke passed.
- M5.3 frontend TypeScript typecheck passed.
- Production build passed.
- Browser UI verified: internal files, client-visible files, internal comments, client-visible comments, threaded replies, comment editing, comment attachments and activity feed.

Next:
- Module 6 - Notifications.

## Module 6 - Notifications [COMPLETE]
Completed: 2026-08-13

### Delivered
- Multi-tenant notification foundation with Notification, NotificationPreference and NotificationDelivery models.
- OrganizationMember-scoped recipients so notifications remain isolated per workspace.
- In-app notification inbox with read/unread state, unread counter, pagination and category filters.
- Notification preferences for TASKS, COMMENTS, FILES, PROJECTS, BILLING and SYSTEM.
- Project-member, task-assignment, task-update, task-move/completed/reopened, comment/reply and file-share event hooks.
- CLIENT visibility-aware collaboration notifications and cross-organization recipient filtering.
- Self-notification suppression and database-level event deduplication.
- Concurrent idempotency hardening for notification creation.
- Header notification bell with 30-second unread polling and compact recent-notification panel.
- Full /app/notifications workspace with Inbox and Preferences views.
- Safe project/task notification deep links.
- Resend email provider adapter using server-side environment configuration.
- Email delivery lifecycle: PENDING -> PROCESSING -> SENT / FAILED.
- Provider message ID, attempt count and failure-state persistence.
- Resend Idempotency-Key protection for provider retries.
- Explicit email modes: disabled, sandbox and live.
- Sandbox mode reroutes development email to the approved Resend account recipient.
- Live mode is intentionally blocked from using the resend.dev test sender and is ready for a verified custom domain later.

### Verification
- M6.1 Prisma format, validation and client generation passed.
- Migration 20260813140000_notifications_foundation deployed successfully.
- Database migration status reported up to date.
- M6.2 monorepo TypeScript typecheck passed.
- Notification repository/service API smoke passed.
- M6.3 event integration smoke passed, including tenant isolation, visibility, preference suppression and concurrent deduplication.
- M6.4 frontend TypeScript typecheck passed.
- M6.4 production build passed.
- Browser verification passed for notification bell, compact inbox, full inbox, preferences, unread state and project/task deep links.
- M6.5 TypeScript typecheck passed.
- Resend sandbox smoke passed and the test email was received.
- Resend provider message ID persistence and duplicate-send prevention verified.
- Final production build passed.

### Deferred by architecture
- Scheduled due-date reminders require a scheduler/worker and remain part of Module 9 Background Jobs.
- BullMQ/Redis queueing, retries and worker processing remain part of Module 9 Background Jobs.
- Production email to real customer recipients requires a verified custom sending domain; sandbox mode is the verified development path until then.

### Next
Module 7 - Invoicing

## Module 7 - Invoicing [COMPLETE]
Completed: 2026-08-13

### Delivered
- Multi-tenant invoicing foundation with invoice settings and persistent invoice numbering.
- Invoice builder with line items, quantities, unit prices, tax/discount calculations and totals.
- Draft, finalized/sent and void invoice lifecycle.
- Historical invoice snapshots so finalized invoices remain stable.
- Invoice list and detail workspaces with edit/finalize/void flows.
- Billing notifications integrated with the existing notification system.
- Server-rendered invoice PDF generation and authenticated download flow.
- ADMIN / MANAGER / MEMBER / linked CLIENT invoice authorization and tenant isolation.

### Verification
- Prisma migration and schema validation passed.
- Invoice backend smoke verification passed.
- Billing notification smoke verification passed.
- Invoice PDF smoke verification passed.
- Frontend TypeScript validation passed.
- Production build passed.
- Browser workflow verified for invoice creation, finalization, detail view and PDF billing.

### Next
Module 8 - Stripe Payments

## Module 8 - Stripe Payments [COMPLETE]
Completed: 2026-08-15

### Delivered
- Stripe test/live/disabled runtime configuration with server-side secret handling.
- Stripe-hosted Checkout Session creation for full and partial invoice payments.
- Decimal-safe payment ledger with Stripe IDs and lifecycle timestamps.
- One-active-checkout protection and idempotent Checkout creation.
- Signed raw-body Stripe webhook endpoint mounted before JSON parsing.
- Webhook idempotency and monotonic payment-state reconciliation.
- Supported Checkout completed, async succeeded, async failed and expired events.
- Exact amount/currency validation and invoice/payment locking during reconciliation.
- Payment notifications integrated into ClientFlow billing notifications.
- Invoice Payments UI with full-balance and partial-payment checkout.
- Payment history, active-checkout resume and processing-state protection.
- Webhook-authoritative success polling; the client never marks an invoice paid from the return URL alone.

### Verification
- Module 8 backend/config/webhook/payment-notification smoke checks passed.
- Web TypeScript validation passed.
- Next.js production build passed with the normal Turbopack build path.
- Real Stripe sandbox Checkout opened successfully from ClientFlow.
- Full-payment test reconciled to SUCCEEDED and invoice PAID.
- Partial-payment test reconciled correctly with remaining balance.
- Second payment against the remaining balance reconciled independently without double-crediting.
- Final invoice balance reached zero and payment history showed both successful Stripe payments.

### Next
Module 9 - Background Jobs

