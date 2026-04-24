-- Temporarily allow anonymous access while auth guard is disabled.
-- These policies are additive to the existing 'authenticated' policies.

DROP POLICY IF EXISTS "anon all experts" ON public.experts;
CREATE POLICY "anon all experts" ON public.experts FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all products" ON public.products;
CREATE POLICY "anon all products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all enrollments" ON public.enrollments;
CREATE POLICY "anon all enrollments" ON public.enrollments FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all enrollment_history" ON public.enrollment_history;
CREATE POLICY "anon all enrollment_history" ON public.enrollment_history FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon all churn" ON public.churn_requests;
CREATE POLICY "anon all churn" ON public.churn_requests FOR ALL TO anon USING (true) WITH CHECK (true);