ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS is_renewal boolean NOT NULL DEFAULT false;