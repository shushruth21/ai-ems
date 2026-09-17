-- Private storage buckets. Object paths MUST start with the organization id:
--   <organization_id>/<entity_type>/<entity_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attachments', 'attachments', false, 26214400,
   array['image/png','image/jpeg','image/webp','application/pdf','text/csv',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('product-media', 'product-media', false, 10485760,
   array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do nothing;

drop policy if exists tenant_objects_read on storage.objects;
create policy tenant_objects_read on storage.objects for select to authenticated
  using (
    bucket_id in ('attachments', 'product-media')
    and (storage.foldername(name))[1] in (select app.current_org_ids())
  );
-- Uploads use short-lived signed upload URLs issued by the server, so there is
-- intentionally no insert policy for the authenticated role.
