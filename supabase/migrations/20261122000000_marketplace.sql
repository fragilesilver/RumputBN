-- RumputBN marketplace schema (Phase 2).
--
-- Security model
-- * Every table has RLS. Table privileges are granted explicitly (the project
--   does not auto-grant new tables to the Data API).
-- * Clients only ever SELECT directly. Every state change that matters
--   (offers, accepting, status changes) goes through SECURITY DEFINER
--   functions below that validate the caller and the transition.
-- * Jobs are INSERTed only by the Next.js server with the secret key, after it
--   recomputes the price from the drawn shapes (never trust client totals).
-- * Cutters never see an open job's exact location or shapes: they get a
--   distance and a ~1 km approximate point from open_jobs_nearby(). Full
--   details become visible once they are assigned.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'cutter');
create type public.grass_condition as enum ('normal', 'long', 'overgrown');
create type public.job_status as enum ('open', 'assigned', 'in_progress', 'completed', 'cancelled');
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Single-row settings table. Change the commission here; it is snapshotted
-- onto each job when an offer is accepted, so old jobs keep their terms.
create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_rate numeric(5, 4) not null default 0.20
    check (commission_rate >= 0 and commission_rate < 1),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  -- Copied from auth.users by trigger; clients cannot set it.
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cutter_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  base_location extensions.geography(point, 4326) not null,
  -- Plain lng/lat copies so the app can read them without parsing PostGIS output.
  base_lng double precision generated always as (extensions.st_x(base_location::extensions.geometry)) stored,
  base_lat double precision generated always as (extensions.st_y(base_location::extensions.geometry)) stored,
  service_radius_km numeric(5, 1) not null default 10
    check (service_radius_km between 1 and 100),
  bio text check (char_length(bio) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cutter_profiles_base_location_idx on public.cutter_profiles using gist (base_location);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  status public.job_status not null default 'open',

  location extensions.geography(point, 4326) not null,
  lng double precision generated always as (extensions.st_x(location::extensions.geometry)) stored,
  lat double precision generated always as (extensions.st_y(location::extensions.geometry)) stored,
  shapes jsonb not null,
  area_m2 integer not null check (area_m2 > 0),
  condition public.grass_condition not null,
  extras jsonb not null,
  quote jsonb not null,
  recommended_price numeric(10, 2) not null,
  fair_min numeric(10, 2) not null,
  fair_max numeric(10, 2) not null,
  preferred_date date,
  notes text check (char_length(notes) <= 500),

  -- Filled in when an offer is accepted.
  cutter_id uuid references public.profiles (id) on delete restrict,
  accepted_offer_id uuid,
  agreed_price numeric(10, 2),
  commission_rate numeric(5, 4),
  platform_fee numeric(10, 2),
  cutter_payout numeric(10, 2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  check (fair_min <= recommended_price and recommended_price <= fair_max),
  check (
    (status = 'open' and cutter_id is null)
    or (status in ('assigned', 'in_progress', 'completed')
        and cutter_id is not null and agreed_price is not null
        and platform_fee is not null and cutter_payout is not null)
    or status = 'cancelled'
  )
);
create index jobs_location_idx on public.jobs using gist (location);
create index jobs_customer_idx on public.jobs (customer_id, created_at desc);
create index jobs_cutter_idx on public.jobs (cutter_id, created_at desc);
create index jobs_open_idx on public.jobs (created_at desc) where status = 'open';

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  cutter_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  message text check (char_length(message) <= 300),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, cutter_id)
);
create index job_offers_cutter_idx on public.job_offers (cutter_id, created_at desc);

alter table public.jobs
  add constraint jobs_accepted_offer_fk
  foreign key (accepted_offer_id) references public.job_offers (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger cutter_profiles_touch before update on public.cutter_profiles
  for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();
create trigger job_offers_touch before update on public.job_offers
  for each row execute function public.touch_updated_at();
create trigger platform_settings_touch before update on public.platform_settings
  for each row execute function public.touch_updated_at();

-- The verified phone number always comes from auth, never from the client.
create function public.profiles_set_phone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select u.phone into new.phone from auth.users u where u.id = new.id;
  return new;
end;
$$;
create trigger profiles_set_phone before insert on public.profiles
  for each row execute function public.profiles_set_phone();

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS; SECURITY DEFINER to avoid policy recursion)
-- ---------------------------------------------------------------------------
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- True when `target` is someone the caller is doing business with:
-- a cutter who offered on / is assigned to the caller's job, or the customer
-- of a job the caller is assigned to.
create function public.is_counterparty(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    where (j.customer_id = (select auth.uid())
           and (j.cutter_id = target
                or exists (select 1 from public.job_offers o
                           where o.job_id = j.id and o.cutter_id = target)))
       or (j.cutter_id = (select auth.uid()) and j.customer_id = target)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.platform_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.cutter_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_offers enable row level security;

create policy "Anyone signed in can read platform settings"
  on public.platform_settings for select to authenticated using (true);

create policy "Read own profile and counterparties"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_counterparty(id));
create policy "Create own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "Update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Read own cutter profile and counterparties"
  on public.cutter_profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_counterparty(id));
create policy "Cutters create own cutter profile"
  on public.cutter_profiles for insert to authenticated
  with check (id = (select auth.uid()) and public.my_role() = 'cutter');
create policy "Cutters update own cutter profile"
  on public.cutter_profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Customers and assigned cutters read their jobs"
  on public.jobs for select to authenticated
  using (customer_id = (select auth.uid()) or cutter_id = (select auth.uid()));

create policy "Cutters read own offers; customers read offers on their jobs"
  on public.job_offers for select to authenticated
  using (
    cutter_id = (select auth.uid())
    or exists (select 1 from public.jobs j
               where j.id = job_id and j.customer_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Privileges (explicit — nothing is exposed to anon)
-- ---------------------------------------------------------------------------
revoke all on public.platform_settings, public.profiles, public.cutter_profiles,
  public.jobs, public.job_offers from anon, authenticated;

grant select on public.platform_settings to authenticated;
grant select on public.profiles to authenticated;
grant insert (id, role, full_name) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select on public.cutter_profiles to authenticated;
grant insert (id, base_location, service_radius_km, bio, is_active) on public.cutter_profiles to authenticated;
grant update (base_location, service_radius_km, bio, is_active) on public.cutter_profiles to authenticated;
grant select on public.jobs to authenticated;
grant select on public.job_offers to authenticated;

grant all on public.platform_settings, public.profiles, public.cutter_profiles,
  public.jobs, public.job_offers to service_role;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Open jobs inside the calling cutter's service area, without exact location.
create function public.open_jobs_nearby()
returns table (
  id uuid,
  area_m2 integer,
  condition public.grass_condition,
  extras jsonb,
  recommended_price numeric,
  fair_min numeric,
  fair_max numeric,
  preferred_date date,
  notes text,
  distance_km numeric,
  approx_lng double precision,
  approx_lat double precision,
  created_at timestamptz,
  my_offer_id uuid,
  my_offer_amount numeric,
  my_offer_status public.offer_status
)
language sql stable security definer set search_path = '' as $$
  select
    j.id, j.area_m2, j.condition, j.extras, j.recommended_price, j.fair_min, j.fair_max,
    j.preferred_date, j.notes,
    round((extensions.st_distance(j.location, c.base_location) / 1000)::numeric, 1),
    round(extensions.st_x(j.location::extensions.geometry)::numeric, 2)::double precision,
    round(extensions.st_y(j.location::extensions.geometry)::numeric, 2)::double precision,
    j.created_at,
    o.id, o.amount, o.status
  from public.cutter_profiles c
  join public.profiles p on p.id = c.id and p.role = 'cutter'
  join public.jobs j
    on j.status = 'open'
   and extensions.st_dwithin(j.location, c.base_location, c.service_radius_km * 1000)
  left join public.job_offers o on o.job_id = j.id and o.cutter_id = c.id
  where c.id = (select auth.uid()) and c.is_active
  order by j.created_at desc
  limit 100;
$$;

-- Make or update an offer. Amount must sit inside the job's fair band.
create function public.make_offer(p_job_id uuid, p_amount numeric, p_message text default null)
returns public.job_offers
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.jobs;
  v_cutter public.cutter_profiles;
  v_offer public.job_offers;
begin
  if public.my_role() is distinct from 'cutter' then
    raise exception 'Only cutters can make offers' using errcode = '42501';
  end if;

  select * into v_cutter from public.cutter_profiles where id = v_uid;
  if not found or not v_cutter.is_active then
    raise exception 'Set up an active service area first' using errcode = 'P0001';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.status <> 'open' then
    raise exception 'This job is no longer open' using errcode = 'P0001';
  end if;

  if not extensions.st_dwithin(v_job.location, v_cutter.base_location, v_cutter.service_radius_km * 1000) then
    raise exception 'This job is outside your service area' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount < v_job.fair_min or p_amount > v_job.fair_max then
    raise exception 'Offer must be between B$% and B$%', v_job.fair_min, v_job.fair_max
      using errcode = 'P0001';
  end if;

  insert into public.job_offers (job_id, cutter_id, amount, message)
  values (p_job_id, v_uid, round(p_amount, 2), nullif(btrim(p_message), ''))
  on conflict (job_id, cutter_id) do update
    set amount = excluded.amount, message = excluded.message, status = 'pending'
  returning * into v_offer;

  return v_offer;
end;
$$;

create function public.withdraw_offer(p_offer_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.job_offers
     set status = 'withdrawn'
   where id = p_offer_id and cutter_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'Offer not found or no longer pending' using errcode = 'P0001';
  end if;
end;
$$;

-- Customer accepts an offer: assigns the job and locks in the money split.
-- Commission maths must match splitEarnings() in web/src/lib/pricing.ts.
create function public.accept_offer(p_offer_id uuid)
returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_offer public.job_offers;
  v_job public.jobs;
  v_rate numeric;
  v_fee numeric;
begin
  select * into v_offer from public.job_offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'pending' then
    raise exception 'Offer not found or no longer pending' using errcode = 'P0001';
  end if;

  select * into v_job from public.jobs where id = v_offer.job_id for update;
  if v_job.customer_id is distinct from (select auth.uid()) then
    raise exception 'Not your job' using errcode = '42501';
  end if;
  if v_job.status <> 'open' then
    raise exception 'This job is no longer open' using errcode = 'P0001';
  end if;

  select commission_rate into v_rate from public.platform_settings where id;
  v_fee := round(v_offer.amount * v_rate, 2);

  update public.job_offers set status = 'accepted' where id = v_offer.id;
  update public.job_offers set status = 'declined'
   where job_id = v_job.id and id <> v_offer.id and status = 'pending';

  update public.jobs
     set status = 'assigned',
         cutter_id = v_offer.cutter_id,
         accepted_offer_id = v_offer.id,
         agreed_price = v_offer.amount,
         commission_rate = v_rate,
         platform_fee = v_fee,
         cutter_payout = v_offer.amount - v_fee
   where id = v_job.id
  returning * into v_job;

  return v_job;
end;
$$;

-- Status changes. Cutter: assigned → in_progress → completed.
-- Customer: open/assigned → cancelled.
create function public.set_job_status(p_job_id uuid, p_status public.job_status)
returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found' using errcode = 'P0001';
  end if;

  if v_job.cutter_id = v_uid and (
       (v_job.status = 'assigned' and p_status = 'in_progress')
    or (v_job.status = 'in_progress' and p_status = 'completed')) then
    null;
  elsif v_job.customer_id = v_uid and p_status = 'cancelled'
        and v_job.status in ('open', 'assigned') then
    update public.job_offers set status = 'declined'
     where job_id = v_job.id and status = 'pending';
  else
    raise exception 'Cannot change this job from % to %', v_job.status, p_status
      using errcode = '42501';
  end if;

  update public.jobs
     set status = p_status,
         completed_at = case when p_status = 'completed' then now() else completed_at end
   where id = v_job.id
  returning * into v_job;
  return v_job;
end;
$$;

-- Functions are executable by PUBLIC by default; lock them down.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.open_jobs_nearby(),
  public.make_offer(uuid, numeric, text),
  public.withdraw_offer(uuid),
  public.accept_offer(uuid),
  public.set_job_status(uuid, public.job_status),
  public.my_role(),
  public.is_counterparty(uuid)
to authenticated;
