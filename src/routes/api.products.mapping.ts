import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

export const Route = createFileRoute("/api/products/mapping")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        const { data, error } = await supabaseAdmin
          .from("products")
          .select("id, name, internal_id, archived, experts(name)")
          .order("name");
        if (error) return jsonResponse({ error: error.message }, 500);

        const mapping = (data ?? []).flatMap((p: any) => {
          const ids: string[] = Array.isArray(p.internal_id) ? p.internal_id : [];
          if (ids.length === 0) return [];
          return ids.map((internal_id) => ({
            internal_id,
            product_id: p.id,
            product_name: p.name,
            expert_name: p.experts?.name ?? null,
            archived: p.archived,
          }));
        });
        return jsonResponse({ mapping });
      },
    },
  },
});
