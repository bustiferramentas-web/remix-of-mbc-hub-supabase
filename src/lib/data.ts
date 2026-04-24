import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeStatus,
  daysToExpire,
  PAYMENT_LABELS,
  STATUS_LABELS,
  type ComputedStatus,
  type EnrollmentLike,
  type PaymentType,
  type TmbStatus,
} from "@/lib/status";

export interface ExpertRow { id: string; name: string; archived: boolean }
export interface ProductRow { id: string; expert_id: string; name: string; archived: boolean; internal_id: string[] | null }
export interface EnrollmentRow extends EnrollmentLike {
  id: string;
  product_id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  is_vitalicio: boolean;
  community_expiration_date: string | null;
  is_renewal: boolean;
  cancellation_date: string | null;
  cancellation_reason: string | null;
  chargeback_count: number;
}
export interface ChurnRow {
  id: string;
  enrollment_id: string;
  requested_at: string;
  reason: string | null;
  reason_category: string | null;
  status: "solicitado" | "em_negociacao" | "revertido" | "concluido";
  resolved_at: string | null;
  notes: string | null;
  handled_by: string | null;
}

export interface EnrichedEnrollment extends EnrollmentRow {
  product_name: string;
  expert_id: string;
  expert_name: string;
  status: ComputedStatus;
  days_to_expire: number;
}

export function useMbcData() {
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [churn, setChurn] = useState<ChurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fetchAllEnrollments = async () => {
        const pageSize = 1000;
        let from = 0;
        const all: EnrollmentRow[] = [];
        while (true) {
          const { data, error } = await supabase
            .from("enrollments")
            .select("*")
            .order("created_at", { ascending: false })
            .range(from, from + pageSize - 1);
          if (error || !data) break;
          all.push(...(data as EnrollmentRow[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const [e, p, en, ch] = await Promise.all([
        supabase.from("experts").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
        fetchAllEnrollments(),
        supabase.from("churn_requests").select("*").order("requested_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setExperts((e.data ?? []) as ExpertRow[]);
      setProducts((p.data ?? []) as ProductRow[]);
      setEnrollments(en);
      setChurn((ch.data ?? []) as ChurnRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const enriched: EnrichedEnrollment[] = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const expertMap = new Map(experts.map((e) => [e.id, e]));
    return enrollments.map((en) => {
      const prod = productMap.get(en.product_id);
      const exp = prod ? expertMap.get(prod.expert_id) : undefined;
      return {
        ...en,
        product_name: prod?.name ?? "—",
        expert_id: prod?.expert_id ?? "",
        expert_name: exp?.name ?? "—",
        status: computeStatus(en),
        days_to_expire: daysToExpire(en),
      };
    });
  }, [enrollments, products, experts]);

  return {
    experts, products, enrollments, churn, enriched, loading,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}

export { PAYMENT_LABELS, STATUS_LABELS };
export type { ComputedStatus, PaymentType, TmbStatus };
