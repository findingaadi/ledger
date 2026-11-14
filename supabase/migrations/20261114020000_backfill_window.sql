-- Monzo refuses transaction requests spanning more than a year, so the first
-- sync walks forward in windows. This is where the current window starts.
alter table accounts add column backfill_from timestamptz;
