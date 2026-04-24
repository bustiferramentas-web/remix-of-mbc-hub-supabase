import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

const PaymentTypeEnum = z.enum(["parcelado", "recorrente", "boleto_tmb"]);
const TmbStatusEnum = z.enum([
  "em_dia",
  "quitado",
  "em_atraso",
  "negativado",
  "cancelado",
  "reembolsado",
]);
const ManualStatusEnum = z.enum(["cancelado", "reembolsado", "inadimplente"]);

const EnrollmentSchema = z.object({
  email: z.string().email().max(255),
  product_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).nullable().optional(),
  payment_type: PaymentTypeEnum,
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  community_expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  last_payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cancellation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cancellation_reason: z.string().max(500).nullable().optional(),
  tmb_status: TmbStatusEnum.nullable().optional(),
  manual_status: ManualStatusEnum.nullable().optional(),
  is_vitalicio: z.boolean().optional(),
  is_renewal: z.boolean().optional(),
  chargeback_count: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const Route = createFileRoute("/api/enrollments")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      POST: async ({ request }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const parsed = EnrollmentSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        }
        const payload = parsed.data;

        // Verify product exists
        const { data: product, error: prodErr } = await supabaseAdmin
          .from("products")
          .select("id")
          .eq("id", payload.product_id)
          .maybeSingle();
        if (prodErr) return jsonResponse({ error: prodErr.message }, 500);
        if (!product) return jsonResponse({ error: "product_id not found" }, 404);

        // Upsert by (email, product_id) — find existing
        const { data: existing, error: findErr } = await supabaseAdmin
          .from("enrollments")
          .select("id")
          .eq("email", payload.email)
          .eq("product_id", payload.product_id)
          .maybeSingle();
        if (findErr) return jsonResponse({ error: findErr.message }, 500);

        if (existing) {
          const { data: updated, error: updErr } = await supabaseAdmin
            .from("enrollments")
            .update(payload)
            .eq("id", existing.id)
            .select()
            .single();
          if (updErr) return jsonResponse({ error: updErr.message }, 500);
          return jsonResponse({ enrollment: updated, action: "updated" });
        }

        const { data: created, error: insErr } = await supabaseAdmin
          .from("enrollments")
          .insert(payload)
          .select()
          .single();
        if (insErr) return jsonResponse({ error: insErr.message }, 500);
        return jsonResponse({ enrollment: created, action: "created" }, 201);
      },
    },
  },
});
