-- Behavioural tests for the marketplace schema and its RLS.
-- Run on a scratch database after supabase_stub.sql and the migrations; any
-- failed expectation raises and stops psql (use -v ON_ERROR_STOP=1).
\set QUIET on
\o /dev/null
\set customer   '''00000000-0000-0000-0000-00000000000c'''
\set customer2  '''00000000-0000-0000-0000-0000000000c2'''
\set cutter     '''00000000-0000-0000-0000-0000000000a1'''
\set farcutter  '''00000000-0000-0000-0000-0000000000a2'''
\set latecutter '''00000000-0000-0000-0000-0000000000a3'''
\set job        '''00000000-0000-0000-0000-0000000000b1'''

create schema tests;
grant usage on schema tests to public;

create function tests.expect_error(sql text, pattern text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error matching "%" but statement succeeded: %', pattern, sql;
exception when others then
  if sqlerrm like 'expected error matching%' then raise; end if;
  if sqlerrm not ilike '%' || pattern || '%' then
    raise exception 'expected error matching "%", got "%" for: %', pattern, sqlerrm, sql;
  end if;
end;
$$;

create function tests.expect(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end;
$$;
grant execute on all functions in schema tests to public;

insert into auth.users (id, phone) values
  (:customer, '6737000001'), (:customer2, '6737000002'),
  (:cutter, '6738000001'), (:farcutter, '6738000002'), (:latecutter, '6738000003');

-- ---- profiles -------------------------------------------------------------
select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect_error(
  $$insert into public.profiles (id, role, full_name, phone) values (auth.uid(), 'customer', 'Aminah', '999')$$,
  'permission denied');
insert into public.profiles (id, role, full_name) values (:customer, 'customer', 'Aminah');
select tests.expect((select phone from public.profiles where id = auth.uid()) = '6737000001',
  'phone is copied from auth, not the client');
select tests.expect_error($$update public.profiles set role = 'cutter'$$, 'permission denied');
select tests.expect_error(
  $$insert into public.profiles (id, role, full_name) values ('00000000-0000-0000-0000-0000000000a1', 'cutter', 'Fake')$$,
  'row-level security');
select tests.expect_error(
  $$insert into public.cutter_profiles (id, base_location) values (auth.uid(), 'SRID=4326;POINT(114.94 4.89)')$$,
  'row-level security');
reset role;

select set_config('request.jwt.claim.sub', :customer2, false);
set role authenticated;
insert into public.profiles (id, role, full_name) values (:customer2, 'customer', 'Hjh Siti');
reset role;

-- Cutter near Bandar Seri Begawan, 10 km radius.
select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
insert into public.profiles (id, role, full_name) values (:cutter, 'cutter', 'Awang Cutters');
insert into public.cutter_profiles (id, base_location, service_radius_km)
  values (:cutter, 'SRID=4326;POINT(114.92 4.90)', 10);
reset role;

-- Cutter in Kuala Belait (~90 km away), 15 km radius.
select set_config('request.jwt.claim.sub', :farcutter, false);
set role authenticated;
insert into public.profiles (id, role, full_name) values (:farcutter, 'cutter', 'KB Lawn');
insert into public.cutter_profiles (id, base_location, service_radius_km)
  values (:farcutter, 'SRID=4326;POINT(114.19 4.58)', 15);
reset role;

select set_config('request.jwt.claim.sub', :latecutter, false);
set role authenticated;
insert into public.profiles (id, role, full_name) values (:latecutter, 'cutter', 'Late Lad');
insert into public.cutter_profiles (id, base_location) values (:latecutter, 'SRID=4326;POINT(114.94 4.89)');
reset role;

-- ---- job creation ---------------------------------------------------------
set role anon;
select tests.expect_error($$select * from public.jobs$$, 'permission denied');
select tests.expect_error($$select public.open_jobs_nearby()$$, 'permission denied');
reset role;

select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect_error(
  $$insert into public.jobs (customer_id, location, shapes, area_m2, condition, extras, quote, recommended_price, fair_min, fair_max)
    values (auth.uid(), 'SRID=4326;POINT(114.93 4.91)', '[]', 300, 'normal', '{}', '{}', 1, 1, 1)$$,
  'permission denied');
reset role;

-- The server inserts jobs with the secret key (service_role).
set role service_role;
insert into public.jobs (id, customer_id, location, shapes, area_m2, condition, extras, quote,
                         recommended_price, fair_min, fair_max)
values (:job, :customer, 'SRID=4326;POINT(114.9312 4.9087)', '[{"type":"Feature"}]', 300, 'normal',
        '{"removeClippings":false,"edging":false,"slope":false}', '{"total":37}', 37, 31, 43);
reset role;

-- ---- visibility -----------------------------------------------------------
select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect((select count(*) from public.jobs) = 1, 'customer sees own job');
select tests.expect_error($$update public.jobs set recommended_price = 1$$, 'permission denied');
reset role;

select set_config('request.jwt.claim.sub', :customer2, false);
set role authenticated;
select tests.expect((select count(*) from public.jobs) = 0, 'other customers cannot see the job');
reset role;

select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
select tests.expect((select count(*) from public.jobs) = 0, 'unassigned cutter cannot read the job row');
select tests.expect((select count(*) from public.open_jobs_nearby()) = 1, 'nearby cutter sees the open job');
select tests.expect(
  (select approx_lng = 114.93 and approx_lat = 4.91 and distance_km between 1 and 3 from public.open_jobs_nearby()),
  'open job location is approximate (2 dp) with a distance');
select tests.expect((select count(*) from public.profiles) = 1, 'cutter cannot see the customer before assignment');
reset role;

select set_config('request.jwt.claim.sub', :farcutter, false);
set role authenticated;
select tests.expect((select count(*) from public.open_jobs_nearby()) = 0, 'far cutter does not see the job');
select tests.expect_error(format('select public.make_offer(%L, 37)', :job), 'outside your service area');
reset role;

-- ---- offers ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect_error(format('select public.make_offer(%L, 37)', :job), 'Only cutters');
reset role;

select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
select tests.expect_error(format('select public.make_offer(%L, 50)', :job), 'between B$31');
select tests.expect_error(format('select public.make_offer(%L, 30)', :job), 'between B$31');
select public.make_offer(:job, 40, 'Can come Saturday');
select public.make_offer(:job, 42, 'Saturday morning');
select tests.expect((select count(*) from public.job_offers) = 1 and (select amount from public.job_offers) = 42,
  'updating an offer keeps one row per cutter');
reset role;

select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect((select count(*) from public.job_offers) = 1, 'customer sees offers on own job');
select tests.expect((select phone from public.profiles where id = :cutter) = '6738000001',
  'customer can see the offering cutter''s profile');
select tests.expect((select count(*) from public.cutter_profiles) = 1, 'customer can see offering cutter''s details');
reset role;

select set_config('request.jwt.claim.sub', :customer2, false);
set role authenticated;
select tests.expect((select count(*) from public.job_offers) = 0, 'other customers cannot see the offers');
select tests.expect_error(
  format('select public.accept_offer(%L)', (select id from public.job_offers limit 1)), 'not found');
reset role;
-- customer2 can't even see the offer id; try with the real id
select set_config('request.jwt.claim.sub', :customer2, false);
select id as offer_id from public.job_offers \gset
set role authenticated;
select tests.expect_error(format('select public.accept_offer(%L)', :'offer_id'), 'Not your job');
reset role;

select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
select tests.expect_error(format('select public.accept_offer(%L)', :'offer_id'), 'Not your job');
reset role;

-- ---- accept & money split -------------------------------------------------
select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select public.accept_offer(:'offer_id');
select tests.expect(
  (select status = 'assigned' and agreed_price = 42 and commission_rate = 0.20
          and platform_fee = 8.40 and cutter_payout = 33.60 from public.jobs),
  'accepting locks in price, 20% platform fee and cutter payout');
select tests.expect_error(format('select public.accept_offer(%L)', :'offer_id'), 'no longer pending');
select tests.expect_error(format('select public.set_job_status(%L, %L)', :job, 'completed'), 'Cannot change');
select tests.expect_error($$update public.platform_settings set commission_rate = 0$$, 'permission denied');
reset role;

select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
select tests.expect((select count(*) from public.jobs) = 1, 'assigned cutter can now read the job');
select tests.expect((select phone from public.profiles where id = :customer) = '6737000001',
  'assigned cutter can see the customer''s contact');
select tests.expect((select count(*) from public.open_jobs_nearby()) = 0, 'assigned job leaves the open list');
reset role;

select set_config('request.jwt.claim.sub', :latecutter, false);
set role authenticated;
select tests.expect_error(format('select public.make_offer(%L, 37)', :job), 'no longer open');
reset role;

-- ---- status flow ----------------------------------------------------------
select set_config('request.jwt.claim.sub', :cutter, false);
set role authenticated;
select tests.expect_error(format('select public.set_job_status(%L, %L)', :job, 'completed'), 'Cannot change');
select public.set_job_status(:job, 'in_progress');
select public.set_job_status(:job, 'completed');
select tests.expect((select status = 'completed' and completed_at is not null from public.jobs), 'cutter completes the job');
reset role;

select set_config('request.jwt.claim.sub', :customer, false);
set role authenticated;
select tests.expect_error(format('select public.set_job_status(%L, %L)', :job, 'cancelled'), 'Cannot change');
reset role;

\echo 'ALL MARKETPLACE TESTS PASSED'
