import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";
import { computeStatus } from "@/lib/status";

export const Route = createFileRoute("/api/enrollments/check")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        const url = new URL(request.url);
        const email = url.searchParams.get("email")?.trim();
        const productInternalId = url.searchParams.get("product_internal_id")?.trim();

        if (!email || !z.string().email().safeParse(email).success) {
          return jsonResponse({ error: "Invalid or missing 'email'" }, 400);
        }
        if (!productInternalId) {
          return jsonResponse({ error: "Missing 'product_internal_id'" }, 400);
        }

        const { data: product, error: prodErr } = await supabaseAdmin
          .from("products")
          .select("id")
          .contains("internal_id", [productInternalId])
          .maybeSingle();
        if (prodErr) return jsonResponse({ error: prodErr.message }, 500);
        if (!product) return jsonResponse({ enrollment: null });

        const { data: enrollments, error } = await supabaseAdmin
          .from("enrollments")
          .select(
            "id, purchase_date, expiration_date, last_payment_date, payment_type, tmb_status, manual_status, is_vitalicio, community_expiration_date, cancellation_reason"
          )
          .eq("email", email)
          .eq("product_id", product.id)
          .order("purchase_date", { ascending: false })
          .limit(1);
        if (error) return jsonResponse({ error: error.message }, 500);
        const enrollment = enrollments?.[0];
        if (!enrollment) return jsonResponse({ enrollment: null });

        const status = computeStatus(enrollment as any);

        return jsonResponse({
          enrollment: {
            id: enrollment.id,
            status,
            purchase_date: enrollment.purchase_date,
            payment_type: enrollment.payment_type,
          },
        });
      },
    },
  },
});
