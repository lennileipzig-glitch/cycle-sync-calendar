ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diet_style text NOT NULL DEFAULT 'omnivore',
  ADD COLUMN IF NOT EXISTS diet_intolerances text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_foods text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sport_level text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS sport_frequency_per_week integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS notification_topics text[] NOT NULL DEFAULT ARRAY['energy_forecast','checkin']::text[],
  ADD COLUMN IF NOT EXISTS custom_symptoms text[] NOT NULL DEFAULT '{}';