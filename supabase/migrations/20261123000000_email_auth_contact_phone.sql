-- Sign-in moves from SMS to email codes, so the phone number no longer comes
-- from auth. Users enter a contact number themselves (used for Call/WhatsApp
-- once a job is booked). It is not verified.

drop trigger if exists profiles_set_phone on public.profiles;
drop function if exists public.profiles_set_phone();

-- Normalise numbers copied from auth (stored without "+").
update public.profiles set phone = '+' || phone where phone ~ '^673[0-9]{7}$';

-- New and edited profiles must carry a Brunei number: +673 and 7 digits.
-- NOT VALID: don't fail on any older rows; every insert/update is still checked.
alter table public.profiles
  add constraint profiles_phone_brunei
  check (phone is not null and phone ~ '^\+673[0-9]{7}$') not valid;

revoke insert, update on public.profiles from authenticated;
grant insert (id, role, full_name, phone) on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
