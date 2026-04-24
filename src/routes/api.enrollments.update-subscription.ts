import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

const Schema = z.object({
  email: z.string().email().max(255),
  product_internal_id: z.string().min(1).max(255),
  last_payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  charged_times: z.number().int().min(0),
});

export const Route = createFileRoute("/api/enrollments/update-subscription")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      PATCH: async ({ request }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        let body: unknown;
        try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

        const parsed = Schema.safeParse(body);
        if (!parsed.success) return jsonResponse({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        const p = parsed.data;

        const { data: product, error: prodErr } = await supabaseAdmin
          .from("products").select("id").contains("internal_id", [p.product_internal_id]).maybeSingle();
        if (prodErr) return jsonResponse({ error: prodErr.message }, 500);
        if (!product) return jsonResponse({ error: `No product mapped to internal_id "${p.product_internal_id}"` }, 404);

        const { data: existing, error: findErr } = await supabaseAdmin
          .from("enrollments")
          .select("id, notes")
          .eq("email", p.email)
          .eq("product_id", product.id)
          .maybeSingle();
        if (findErr) return jsonResponse({ error: findErr.message }, 500);
        if (!existing) return jsonResponse({ error: "Enrollment not found" }, 404);

        const { data: updated, error } = await supabaseAdmin
          .from("enrollments")
          .update({ last_payment_date: p.last_payment_date.slice(0, 10) })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);

        return jsonResponse({ enrollment: updated, charged_times: p.charged_times, action: "updated" });
      },
    },
  },
});
