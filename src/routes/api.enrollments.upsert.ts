import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected ISO date");

const Schema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).nullable().optional(),
  product_internal_id: z.string().min(1).max(255),
  payment_type: z.enum(["parcelado", "recorrente"]),
  purchase_date: isoDate,
  last_payment_date: isoDate.nullable().optional(),
  expiration_date: isoDate.nullable().optional(),
  status: z.enum(["ativo", "expirado", "cancelado", "reembolsado"]),
  cancellation_date: isoDate.nullable().optional(),
  cancellation_reason: z.string().max(500).nullable().optional(),
  chargeback_count: z.number().int().min(0).optional(),
  is_vitalicio: z.boolean().optional(),
  is_renewal: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function statusToManual(s: string): "cancelado" | "reembolsado" | null {
  if (s === "cancelado") return "cancelado";
  if (s === "reembolsado") return "reembolsado";
  return null;
}

const truncDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : d ?? null);

export const Route = createFileRoute("/api/enrollments/upsert")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      POST: async ({ request }) => {
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

        const payload = {
          product_id: product.id,
          email: p.email,
          name: p.name,
          phone: p.phone ?? null,
          payment_type: p.payment_type,
          purchase_date: truncDate(p.purchase_date)!,
          last_payment_date: truncDate(p.last_payment_date),
          expiration_date: truncDate(p.expiration_date),
          manual_status: statusToManual(p.status),
          cancellation_date: truncDate(p.cancellation_date),
          cancellation_reason: p.cancellation_reason ?? null,
          chargeback_count: p.chargeback_count ?? 0,
          is_vitalicio: p.is_vitalicio ?? false,
          is_renewal: p.is_renewal ?? false,
          notes: p.notes ?? null,
        };

        const { data: existing, error: findErr } = await supabaseAdmin
          .from("enrollments").select("id").eq("email", p.email).eq("product_id", product.id).maybeSingle();
        if (findErr) return jsonResponse({ error: findErr.message }, 500);

        if (existing) {
          const { data: updated, error } = await supabaseAdmin
            .from("enrollments").update(payload).eq("id", existing.id).select().single();
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({ enrollment: updated, action: "updated" });
        }

        const { data: created, error } = await supabaseAdmin
          .from("enrollments").insert(payload).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ enrollment: created, action: "created" }, 201);
      },
    },
  },
});
