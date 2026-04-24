-- Convert products.internal_id from text to text[] to support multiple Guru IDs per product
ALTER TABLE public.products
  ALTER COLUMN internal_id DROP DEFAULT;

ALTER TABLE public.products
  ALTER COLUMN internal_id TYPE text[]
  USING CASE
    WHEN internal_id IS NULL OR btrim(internal_id) = '' THEN NULL
    ELSE ARRAY[internal_id]
  END;

-- Index for fast lookup by any element in the array
CREATE INDEX IF NOT EXISTS idx_products_internal_id_gin
  ON public.products USING GIN (internal_id);
