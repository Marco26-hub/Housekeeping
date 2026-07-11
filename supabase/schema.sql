-- Daily Cleaning Report — Schema + RLS
-- Run inside Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ENUMS
do $$ begin
  create type user_role as enum ('employee','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_type as enum ('appartamento','villa','ufficio','bnb','casa_vacanza','condominio','negozio','studio','altro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('bozza','completato','inviato','ricevuto','approvato','contestato');
exception when duplicate_object then null; end $$;

-- COMPANIES
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  admin_email text,
  telegram_chat_id text,
  created_at timestamptz default now()
);

-- PROFILES (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'employee',
  phone text,
  created_at timestamptz default now()
);
create index if not exists idx_profiles_company on profiles(company_id);

-- PROPERTIES / CLIENTS
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_name text not null,
  address text not null,
  property_type property_type not null,
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_properties_company on properties(company_id);

-- REPORT TEMPLATES
create table if not exists report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references report_templates(id) on delete cascade,
  section text not null,
  label text not null,
  sort_order int default 0
);
create index if not exists idx_template_tasks_template on template_tasks(template_id);

-- REPORTS
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  operator_id uuid not null references profiles(id) on delete restrict,
  property_id uuid references properties(id) on delete set null,
  client_name text not null,
  address text not null,
  property_type property_type not null,
  intervention_date date not null,
  time_in time not null,
  time_out time,
  break_minutes int default 0,
  total_hours numeric(5,2),
  notes text,
  status report_status not null default 'bozza',
  template_id uuid references report_templates(id),
  pdf_url text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  contested_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_reports_company on reports(company_id);
create index if not exists idx_reports_operator on reports(operator_id);
create index if not exists idx_reports_date on reports(intervention_date);
create index if not exists idx_reports_status on reports(status);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_reports_updated on reports;
create trigger trg_reports_updated before update on reports for each row execute function set_updated_at();

-- REPORT TASKS (checklist)
create table if not exists report_tasks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  section text not null,
  label text not null,
  done boolean default false,
  sort_order int default 0
);
create index if not exists idx_report_tasks_report on report_tasks(report_id);

-- REPORT ANOMALIES
create table if not exists report_anomalies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  code text not null,
  detail text
);
create index if not exists idx_report_anomalies_report on report_anomalies(report_id);

-- REPORT PHOTOS
create table if not exists report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  kind text not null check (kind in ('before','after','anomaly')),
  storage_path text not null,
  created_at timestamptz default now()
);
create index if not exists idx_report_photos_report on report_photos(report_id);

-- REPORT SIGNATURES
create table if not exists report_signatures (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  kind text not null check (kind in ('operator','client')),
  data_url text not null,
  signed_at timestamptz default now()
);
create index if not exists idx_report_signatures_report on report_signatures(report_id);

-- REPORT SENDS (log)
create table if not exists report_sends (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  channel text not null check (channel in ('email','telegram','whatsapp')),
  target text,
  success boolean not null,
  error text,
  sent_by uuid references profiles(id),
  sent_at timestamptz default now()
);
create index if not exists idx_report_sends_report on report_sends(report_id);

-- HELPER: current user's company + role
create or replace function auth_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function auth_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

revoke all on function auth_company_id() from public;
revoke all on function auth_is_admin() from public;
grant execute on function auth_company_id() to authenticated, service_role;
grant execute on function auth_is_admin() to authenticated, service_role;

-- ENABLE RLS
alter table companies enable row level security;
alter table profiles enable row level security;
alter table properties enable row level security;
alter table report_templates enable row level security;
alter table template_tasks enable row level security;
alter table reports enable row level security;
alter table report_tasks enable row level security;
alter table report_anomalies enable row level security;
alter table report_photos enable row level security;
alter table report_signatures enable row level security;
alter table report_sends enable row level security;

-- COMPANIES policies
drop policy if exists companies_select on companies;
create policy companies_select on companies for select using (id = auth_company_id());
drop policy if exists companies_update on companies;
create policy companies_update on companies for update using (id = auth_company_id() and auth_is_admin());

-- PROFILES policies
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (company_id = auth_company_id());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid() or (auth_is_admin() and company_id = auth_company_id()));

-- PROPERTIES policies (admin manages)
drop policy if exists properties_select on properties;
create policy properties_select on properties for select using (company_id = auth_company_id());
drop policy if exists properties_modify on properties;
create policy properties_modify on properties for all
  using (company_id = auth_company_id() and auth_is_admin())
  with check (company_id = auth_company_id() and auth_is_admin());

-- TEMPLATES policies
drop policy if exists templates_select on report_templates;
create policy templates_select on report_templates for select using (company_id = auth_company_id());
drop policy if exists templates_modify on report_templates;
create policy templates_modify on report_templates for all
  using (company_id = auth_company_id() and auth_is_admin())
  with check (company_id = auth_company_id() and auth_is_admin());

drop policy if exists template_tasks_select on template_tasks;
create policy template_tasks_select on template_tasks for select using (
  exists (select 1 from report_templates t where t.id = template_id and t.company_id = auth_company_id())
);
drop policy if exists template_tasks_modify on template_tasks;
create policy template_tasks_modify on template_tasks for all using (
  exists (select 1 from report_templates t where t.id = template_id and t.company_id = auth_company_id() and auth_is_admin())
) with check (
  exists (select 1 from report_templates t where t.id = template_id and t.company_id = auth_company_id() and auth_is_admin())
);

-- REPORTS policies
drop policy if exists reports_select on reports;
create policy reports_select on reports for select using (
  company_id = auth_company_id() and (auth_is_admin() or operator_id = auth.uid())
);
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert with check (
  company_id = auth_company_id() and operator_id = auth.uid()
);
drop policy if exists reports_update on reports;
create policy reports_update on reports for update using (
  company_id = auth_company_id() and (
    auth_is_admin() or (operator_id = auth.uid() and status = 'bozza')
  )
);
drop policy if exists reports_delete on reports;
create policy reports_delete on reports for delete using (
  company_id = auth_company_id() and auth_is_admin()
);

-- child tables share parent permissions
drop policy if exists rt_all on report_tasks;
create policy rt_all on report_tasks for all using (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
) with check (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
);

drop policy if exists ra_all on report_anomalies;
create policy ra_all on report_anomalies for all using (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
) with check (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
);

drop policy if exists rp_all on report_photos;
create policy rp_all on report_photos for all using (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
) with check (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
);

drop policy if exists rs_all on report_signatures;
create policy rs_all on report_signatures for all using (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
) with check (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or (r.operator_id = auth.uid() and r.status = 'bozza')))
);

drop policy if exists rsend_select on report_sends;
create policy rsend_select on report_sends for select using (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id() and (auth_is_admin() or r.operator_id = auth.uid()))
);
drop policy if exists rsend_insert on report_sends;
create policy rsend_insert on report_sends for insert with check (
  exists (select 1 from reports r where r.id = report_id and r.company_id = auth_company_id())
);

-- STORAGE buckets and policies are installed by storage_setup.sql.
