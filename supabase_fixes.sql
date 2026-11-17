-- Run after supabase/migrations/20261117000000_agrihub_supabase.sql.
-- Adds public read access for active listings, verified seller profiles,
-- and currently active sponsor banners without exposing private profile data.
begin;

grant usage on schema public to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sponsors enable row level security;

-- Remove inherited/public privileges, then grant back only intended reads.
revoke all on table public.profiles, public.products, public.sponsors
  from anon, public;
grant select on table public.products to anon, authenticated;
grant select (
  id,
  title,
  subtitle,
  duration_days,
  banner_color,
  image_url,
  seller_id,
  status,
  created_at,
  updated_at
) on table public.sponsors to anon;
grant select on table public.sponsors to authenticated;
grant select on table public.profiles
  to authenticated;

-- Anonymous clients may read only these non-sensitive profile fields.
grant select (
  id,
  full_name,
  avatar_url,
  is_verified,
  is_sponsored,
  store_name,
  store_address,
  department,
  role,
  verification_status
) on table public.profiles to anon;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select_public_verified_sellers"
  on public.profiles;
create policy "profiles_select_public_verified_sellers"
  on public.profiles
  for select
  to anon, authenticated
  using (
    role = 'seller'
    and is_verified
    and verification_status = 'verified'
  );

-- The public store feed excludes sold-out listings; owners and admins can
-- still see their own listings and manage them under the existing write rules.
drop policy if exists "products_select_published_or_owner"
  on public.products;
create policy "products_select_published_or_owner"
  on public.products
  for select
  to anon, authenticated
  using (
    (status = 'published' and available_stock > 0)
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

-- A sponsor banner remains public only while its approval is active and its
-- duration has not elapsed since its most recent update/approval.
drop policy if exists "sponsors_select_approved_or_admin"
  on public.sponsors;
create policy "sponsors_select_approved_or_admin"
  on public.sponsors
  for select
  to anon, authenticated
  using (
    (
      status = 'approved'
      and updated_at + duration_days * interval '1 day' > now()
    )
    or public.is_admin()
  );

-- Preserve the audited admin-only sponsor mutation policies.
drop policy if exists "sponsors_insert_admin" on public.sponsors;
create policy "sponsors_insert_admin"
  on public.sponsors
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "sponsors_update_admin" on public.sponsors;
create policy "sponsors_update_admin"
  on public.sponsors
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sponsors_delete_admin" on public.sponsors;
create policy "sponsors_delete_admin"
  on public.sponsors
  for delete
  to authenticated
  using (public.is_admin());

-- The invoker view respects the profile RLS policy and exposes no contact,
-- identity-document, or semester-payment columns.
create or replace view public.public_seller_profiles
with (security_barrier = true, security_invoker = true)
as
select
  id,
  full_name,
  avatar_url,
  is_verified,
  is_sponsored,
  store_name,
  store_address,
  department
from public.profiles
where role = 'seller'
  and is_verified
  and verification_status = 'verified';

grant select on public.public_seller_profiles to anon, authenticated;

commit;
