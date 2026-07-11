-- Supabase Storage buckets and tenant-isolation policies.
-- Run after schema.sql and migration_v1.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-photos', 'report-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('report-pdfs', 'report-pdfs', false, 52428800, array['application/pdf']),
  ('company-logos', 'company-logos', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tenant_storage_read on storage.objects;
create policy tenant_storage_read on storage.objects for select to authenticated
using (
  bucket_id in ('report-photos', 'report-pdfs', 'company-logos')
  and (storage.foldername(name))[1] = public.auth_company_id()::text
);

drop policy if exists tenant_photos_insert on storage.objects;
create policy tenant_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
);

drop policy if exists tenant_photos_update on storage.objects;
create policy tenant_photos_update on storage.objects for update to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
)
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
);

drop policy if exists tenant_photos_delete on storage.objects;
create policy tenant_photos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
);

drop policy if exists tenant_logos_admin_write on storage.objects;
create policy tenant_logos_admin_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
  and public.auth_is_admin()
);

drop policy if exists tenant_logos_admin_update on storage.objects;
create policy tenant_logos_admin_update on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
  and public.auth_is_admin()
)
with check (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
  and public.auth_is_admin()
);

drop policy if exists tenant_logos_admin_delete on storage.objects;
create policy tenant_logos_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = public.auth_company_id()::text
  and public.auth_is_admin()
);
