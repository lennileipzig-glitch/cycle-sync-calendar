ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS endometriosis_status text NOT NULL DEFAULT 'none'
CHECK (endometriosis_status IN ('none', 'suspected', 'diagnosed'));