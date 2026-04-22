ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS energy_cost numeric(2,1),
  ADD COLUMN IF NOT EXISTS is_flexible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_freq text,
  ADD COLUMN IF NOT EXISTS recurrence_until date;

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS energy_cost numeric(2,1),
  ADD COLUMN IF NOT EXISTS is_flexible boolean NOT NULL DEFAULT false;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_recurrence_freq_chk
  CHECK (recurrence_freq IS NULL OR recurrence_freq IN ('daily','weekly','monthly'));

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_energy_cost_chk
  CHECK (energy_cost IS NULL OR (energy_cost >= 1 AND energy_cost <= 5));

ALTER TABLE public.todos
  ADD CONSTRAINT todos_energy_cost_chk
  CHECK (energy_cost IS NULL OR (energy_cost >= 1 AND energy_cost <= 5));