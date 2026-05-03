DROP POLICY IF EXISTS "Insert own events or in shared calendars" ON public.calendar_events;
DROP POLICY IF EXISTS "Update own events or own shared additions" ON public.calendar_events;
DROP POLICY IF EXISTS "Delete own events or own shared additions" ON public.calendar_events;

CREATE POLICY "Insert own events or in shared calendars"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR (shared_via IS NOT NULL AND public.has_accepted_share(user_id, auth.uid()))
);

CREATE POLICY "Update own events or own shared additions"
ON public.calendar_events FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR (shared_via IS NOT NULL AND public.has_accepted_share(user_id, auth.uid()))
);

CREATE POLICY "Delete own events or own shared additions"
ON public.calendar_events FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR (shared_via IS NOT NULL AND public.has_accepted_share(user_id, auth.uid()))
);