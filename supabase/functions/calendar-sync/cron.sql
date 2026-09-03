-- ============================================================
-- Daily agenda digest — scheduled trigger
-- ============================================================
-- Runs the calendar-sync Edge Function's `dailyDigest` action every day
-- at 06:00 America/Sao_Paulo (09:00 UTC — Brazil has no DST since 2019),
-- well before the 9am popup reminder it creates. Requires pg_cron and
-- pg_net (both enabled on this project).
--
-- The anon key below is the same public key already shipped in the site's
-- client bundle (VITE_SUPABASE_ANON_KEY) — safe to embed here, it carries
-- no elevated privileges of its own.

select cron.schedule(
  'daily-agenda-digest',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://uobbgzlcryyhqwkrrnxu.supabase.co/functions/v1/calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_7OkpB-Y1mJWh1yOSU8lGGQ_-Z8Veck_'
    ),
    body := jsonb_build_object('action', 'dailyDigest')
  );
  $$
);
