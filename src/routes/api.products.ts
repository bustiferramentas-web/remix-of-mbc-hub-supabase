import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApiKey, jsonResponse, optionsResponse } from "@/lib/api-auth";

export const Route = createFileRoute("/api/products")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) => {
        const unauthorized = checkApiKey(request);
        if (unauthorized) return unauthorized;

        const { data, error } = await supabaseAdmin
          .from("products")
          .select("id, name, expert_id, archived, experts(id, name)")
          .order("name");

        if (error) return jsonResponse({ error: error.message }, 500);

        const products = (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          archived: p.archived,
          expert_id: p.expert_id,
          expert_name: p.experts?.name ?? null,
        }));
        return jsonResponse({ products });
      },
    },
  },
});
