-- Remove anonymous full access policies
DROP POLICY IF EXISTS "anon all churn" ON public.churn_requests;
DROP POLICY IF EXISTS "anon all enrollment_history" ON public.enrollment_history;
DROP POLICY IF EXISTS "anon all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "anon all experts" ON public.experts;
DROP POLICY IF EXISTS "anon all imports" ON public.imports;
DROP POLICY IF EXISTS "anon all products" ON public.products;

-- Revoke Data API privileges from anon
REVOKE ALL ON public.churn_requests FROM anon;
REVOKE ALL ON public.enrollment_history FROM anon;
REVOKE ALL ON public.enrollments FROM anon;
REVOKE ALL ON public.experts FROM anon;
REVOKE ALL ON public.imports FROM anon;
REVOKE ALL ON public.products FROM anon;

-- Ensure authenticated access remains explicit and scoped to signed-in users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.churn_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollment_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;

DROP POLICY IF EXISTS "auth all churn" ON public.churn_requests;
CREATE POLICY "auth all churn" ON public.churn_requests FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth all enrollment_history" ON public.enrollment_history;
CREATE POLICY "auth all enrollment_history" ON public.enrollment_history FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth all enrollments" ON public.enrollments;
CREATE POLICY "auth all enrollments" ON public.enrollments FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger helper functions must not be callable through the API
REVOKE ALL ON FUNCTION public.handle_churn_concluido() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_enrollment_manually_edited() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_cancellation_date() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;