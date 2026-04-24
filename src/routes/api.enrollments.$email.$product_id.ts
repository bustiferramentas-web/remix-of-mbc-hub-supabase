import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

const ManualStatusEnum = z.enum(["cancelado", "reembolsado", "inadimplente"]);
const TmbStatusEnum = z.enum([
  "em_dia",
  "quitado",
  "em_atraso",
  "negativado",
  "cancelado",
  "reembolsado",
]);

const PatchSchema = z
  .object({
    manual_status: ManualStatusEnum.nullable().optional(),
    tmb_status: TmbStatusEnum.nullable().optional(),
    cancellation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    cancellation_reason: z.string().max(500).nullable().optional(),
    last_payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    community_expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    chargeback_count: z.number().int().min(0).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields provided to update" });

export const Route = createFileRoute("/api/enrollments/$email/$product_id")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      PATCH: async ({ request, params }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        const email = decodeURIComponent(params.email);
        const productId = params.product_id;

        if (!z.string().uuid().safeParse(productId).success) {
          return jsonResponse({ error: "Invalid product_id" }, 400);
        }
        if (!z.string().email().safeParse(email).success) {
          return jsonResponse({ error: "Invalid email" }, 400);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const parsed = PatchSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse({ error: "Validation failed", details: parsed.error.flatten() }, 400);
        }

        const { data: existing, error: findErr } = await supabaseAdmin
          .from("enrollments")
          .select("id")
          .eq("email", email)
          .eq("product_id", productId)
          .maybeSingle();
        if (findErr) return jsonResponse({ error: findErr.message }, 500);
        if (!existing) return jsonResponse({ error: "Enrollment not found" }, 404);

        const { data: updated, error: updErr } = await supabaseAdmin
          .from("enrollments")
          .update(parsed.data)
          .eq("id", existing.id)
          .select()
          .single();
        if (updErr) return jsonResponse({ error: updErr.message }, 500);

        return jsonResponse({ enrollment: updated, action: "updated" });
      },
    },
  },
});
