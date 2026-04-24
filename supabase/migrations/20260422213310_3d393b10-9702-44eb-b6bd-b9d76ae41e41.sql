ALTER TABLE public.products ADD COLUMN internal_id text;
CREATE UNIQUE INDEX products_internal_id_unique ON public.products (internal_id) WHERE internal_id IS NOT NULL;