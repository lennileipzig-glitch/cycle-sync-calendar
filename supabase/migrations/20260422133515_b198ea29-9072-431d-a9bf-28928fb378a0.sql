-- 1. Sharing-Tabelle
CREATE TABLE public.calendar_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  recipient_email text,
  recipient_user_id uuid,
  show_phases boolean NOT NULL DEFAULT false,
  invite_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  invite_method text NOT NULL DEFAULT 'link' CHECK (invite_method IN ('email','link')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT calendar_shares_token_unique UNIQUE (invite_token),
  CONSTRAINT calendar_shares_recipient_required CHECK (
    recipient_email IS NOT NULL OR recipient_user_id IS NOT NULL OR invite_method = 'link'
  )
);

CREATE INDEX idx_calendar_shares_owner ON public.calendar_shares(owner_id);
CREATE INDEX idx_calendar_shares_recipient_user ON public.calendar_shares(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX idx_calendar_shares_recipient_email ON public.calendar_shares(lower(recipient_email)) WHERE recipient_email IS NOT NULL;

ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;

-- 2. Spalte shared_via in calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS shared_via uuid REFERENCES public.calendar_shares(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_shared_via ON public.calendar_events(shared_via) WHERE shared_via IS NOT NULL;

-- 3. Security-Definer Helper, damit RLS keinen Zirkelbezug auslöst
CREATE OR REPLACE FUNCTION public.has_accepted_share(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.calendar_shares s
    WHERE s.owner_id = _owner
      AND s.status = 'accepted'
      AND (
        s.recipient_user_id = _viewer
        OR (
          s.recipient_email IS NOT NULL
          AND lower(s.recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = _viewer), ''))
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.share_phase_visibility(_owner uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(bool_or(s.show_phases), false)
  FROM public.calendar_shares s
  WHERE s.owner_id = _owner
    AND s.status = 'accepted'
    AND (
      s.recipient_user_id = _viewer
      OR (
        s.recipient_email IS NOT NULL
        AND lower(s.recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = _viewer), ''))
      )
    );
$$;

-- 4. RLS-Policies calendar_shares
CREATE POLICY "Owners manage own shares"
  ON public.calendar_shares
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Recipients can view their invites"
  ON public.calendar_shares
  FOR SELECT
  USING (
    auth.uid() = recipient_user_id
    OR (
      recipient_email IS NOT NULL
      AND lower(recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
    )
  );

CREATE POLICY "Recipients can accept their invites"
  ON public.calendar_shares
  FOR UPDATE
  USING (
    auth.uid() = recipient_user_id
    OR (
      recipient_email IS NOT NULL
      AND lower(recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
    )
  )
  WITH CHECK (
    status IN ('accepted','revoked')
    AND (
      auth.uid() = recipient_user_id
      OR (
        recipient_email IS NOT NULL
        AND lower(recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
      )
    )
  );

-- 5. RLS-Policies calendar_events anpassen
DROP POLICY IF EXISTS "Users manage own events" ON public.calendar_events;

CREATE POLICY "View own or shared events"
  ON public.calendar_events
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_accepted_share(user_id, auth.uid())
  );

CREATE POLICY "Insert own events or in shared calendars"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR (
      shared_via IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.calendar_shares s
        WHERE s.id = shared_via
          AND s.owner_id = calendar_events.user_id
          AND s.status = 'accepted'
          AND (
            s.recipient_user_id = auth.uid()
            OR (
              s.recipient_email IS NOT NULL
              AND lower(s.recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
            )
          )
      )
    )
  );

CREATE POLICY "Update own events or own shared additions"
  ON public.calendar_events
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (
      shared_via IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.calendar_shares s
        WHERE s.id = shared_via
          AND s.status = 'accepted'
          AND (
            s.recipient_user_id = auth.uid()
            OR (
              s.recipient_email IS NOT NULL
              AND lower(s.recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
            )
          )
      )
    )
  );

CREATE POLICY "Delete own events or own shared additions"
  ON public.calendar_events
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR (
      shared_via IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.calendar_shares s
        WHERE s.id = shared_via
          AND s.status = 'accepted'
          AND (
            s.recipient_user_id = auth.uid()
            OR (
              s.recipient_email IS NOT NULL
              AND lower(s.recipient_email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), ''))
            )
          )
      )
    )
  );