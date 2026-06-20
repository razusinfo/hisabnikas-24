আপনি ৪টা বড় feature চেয়েছেন। সবকিছু একসাথে এক message এ করলে existing data ভাঙবে এবং review করা যাবে না। তাই ধাপে ধাপে — প্রতি phase শেষে আপনি verify করবেন, তারপর পরের phase।

## Phase 1 — Multi-branch foundation (এই turn এ শুরু)

**Database**
- `companies` table (owner_id, name, address, logo)
- `branches` table (company_id, name, code, address, phone, is_main, is_active)
- `branch_users` table (branch_id, user_id, role) — কোন user কোন branch এ কাজ করতে পারবে
- সব existing transactional table এ `branch_id uuid` যোগ:
  `sales`, `purchases`, `expenses`, `cashbook`, `customers`, `products`, `mfs_sms_inbox`, `mfs_accounts`
- প্রতি owner এর জন্য default "Main Branch" auto-create করে existing rows backfill
- Helper functions: `user_branches(uid)`, `current_branch_id()` (session setting), `user_can_access_branch(uid, branch_id)`
- RLS update: super_admin → সব branch; অন্যরা → শুধু own branch (via `branch_users`)

**UI**
- `/branches` page — branch list, create/edit/deactivate
- AppShell এ Branch Switcher dropdown (top bar) — selected branch localStorage এ save, সব query এ filter
- নতুন Sale/Purchase/Expense entry এ auto `branch_id = current branch`

## Phase 2 — Roles & Permissions
- `app_role` enum extend: `owner`, `manager`, `cashier`, `store_manager`, `accountant`, `salesman`
- `permissions` + `role_permissions` table (granular: `sales.create`, `purchase.delete`, `report.view` etc.)
- `/users` page — invite user, assign role per branch
- Frontend route guard + button-level permission check via `hasPermission(key)` hook

## Phase 3 — Audit Log
- `audit_logs` table (actor, branch_id, table_name, row_id, action, old_data, new_data, ip, ua, created_at)
- Generic Postgres trigger function attached to all main tables (INSERT/UPDATE/DELETE)
- `/audit-log` page — filterable timeline (Super Admin/Owner only)

## Phase 4 — Warehouse + Stock transfer
- `warehouses` table (branch_id, name, code)
- `product_stock` table (product_id, warehouse_id, qty) — replaces single `products.stock`
- `stock_transfers` + `stock_transfer_items` (from_warehouse, to_warehouse, status: draft/in_transit/received)
- Sale/Purchase এ warehouse picker
- `/warehouses` + `/stock-transfer` pages

## Notes
- কোনো existing data মুছবে না — শুধু `branch_id` যোগ করে default branch এ backfill
- প্রতিটা migration আপনাকে approve করতে হবে
- প্রতিটা phase এর পর verify করে বলবেন → পরের phase শুরু হবে

এই plan ঠিক থাকলে আমি **Phase 1 (Multi-branch)** এর migration এখনই তৈরি করব।