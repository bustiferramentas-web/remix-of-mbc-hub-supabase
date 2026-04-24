import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

const Schema = z.object({
  email: z.string().email().max(255),
  product_internal_id: z.string().min(1).max(255),
  status: z.enum(["cancelado", "reembolsado", "inadimplente"]),
  cancellation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  cancellation_reason: z.string().max(500),
  chargeback_count: z.number().int().min(0),
});

export const Route = createFileRoute("/api/enrollments/cancel")({
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
          .from("enrollments").select("id").eq("email", p.email).eq("product_id", product.id).maybeSingle();
        if (findErr) return jsonResponse({ error: findErr.message }, 500);
        if (!existing) return jsonResponse({ error: "Enrollment not found" }, 404);

        const { data: updated, error } = await supabaseAdmin
          .from("enrollments")
          .update({
            manual_status: p.status,
            cancellation_date: p.cancellation_date.slice(0, 10),
            cancellation_reason: p.cancellation_reason,
            chargeback_count: p.chargeback_count,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ enrollment: updated, action: "updated" });
      },
    },
  },
});
