ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'termin',
  ADD COLUMN IF NOT EXISTS details text;

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_category_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_category_check
  CHECK (category IN ('termin','mahlzeit','sport'));

CREATE INDEX IF NOT EXISTS calendar_events_user_date_cat_idx
  ON public.calendar_events (user_id, starts_at, category);