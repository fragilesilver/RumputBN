-- Launch commission: 10% of the agreed price, taken from the cutter's side.
-- Jobs already accepted keep the rate they were booked at.
alter table public.platform_settings alter column commission_rate set default 0.10;
update public.platform_settings set commission_rate = 0.10 where id;
