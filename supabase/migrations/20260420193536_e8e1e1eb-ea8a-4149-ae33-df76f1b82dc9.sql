-- 1) Rename enum value cartao_12x -> parcelado, cartao_recorrente -> recorrente
ALTER TYPE public.payment_type RENAME VALUE 'cartao_12x' TO 'parcelado';
ALTER TYPE public.payment_type RENAME VALUE 'cartao_recorrente' TO 'recorrente';

-- 2) New columns
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS is_vitalicio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_expiration_date date;

-- Allow expiration_date to be null for vitalício
ALTER TABLE public.enrollments ALTER COLUMN expiration_date DROP NOT NULL;