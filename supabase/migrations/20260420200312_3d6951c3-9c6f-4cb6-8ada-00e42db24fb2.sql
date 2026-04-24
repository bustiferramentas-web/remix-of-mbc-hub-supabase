-- imports log table
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  expert_id uuid REFERENCES public.experts(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  imported_by text
);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon all imports" ON public.imports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "auth all imports" ON public.imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link enrollments to their import + manual-edit flag
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manually_edited boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_enrollments_import_id ON public.enrollments(import_id);

-- Auto-mark manually_edited on UPDATE (but not when the update itself sets the flag,
-- and not when the only change is the flag/timestamps)
CREATE OR REPLACE FUNCTION public.mark_enrollment_manually_edited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.import_id IS NOT NULL AND NEW.manually_edited = OLD.manually_edited THEN
    NEW.manually_edited = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_enrollment_manually_edited ON public.enrollments;
CREATE TRIGGER trg_mark_enrollment_manually_edited
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.mark_enrollment_manually_edited();