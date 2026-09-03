-- ============================================================
-- Auto-expire past blocked_slots
-- ============================================================
-- Runs daily at 00:10 America/Sao_Paulo (03:10 UTC — Brazil has no
-- DST since 2019) and marks any blocked_slots whose date has already
-- passed as inactive. Purely a housekeeping/UI-hygiene job — expired
-- blocks are already harmless for booking (past dates can't be booked
-- anyway), this just keeps the admin "Bloqueios" list meaningful by
-- moving old entries out of the active set automatically.

select cron.schedule(
  'expire-blocked-slots',
  '10 3 * * *',
  $$
  update blocked_slots
  set is_active = false
  where blocked_date < current_date and is_active = true;
  $$
);
