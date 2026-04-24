-- Add cancellation tracking fields
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS cancellation_date date,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Trigger to auto-fill cancellation_date when manual_status changes to cancelado/reembolsado
CREATE OR REPLACE FUNCTION public.set_cancellation_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.manual_status IN ('cancelado', 'reembolsado')
     AND (OLD.manual_status IS DISTINCT FROM NEW.manual_status)
     AND NEW.cancellation_date IS NULL THEN
    NEW.cancellation_date = CURRENT_DATE;
  END IF;
  IF NEW.manual_status IS NULL THEN
    NEW.cancellation_date = NULL;
    NEW.cancellation_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cancellation_date ON public.enrollments;
CREATE TRIGGER trg_set_cancellation_date
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.set_cancellation_date();