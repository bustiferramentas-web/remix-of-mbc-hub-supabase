import { differenceInCalendarDays, parseISO, startOfMonth, subMonths, format, isValid } from "date-fns";
import type { EnrichedEnrollment } from "@/lib/data";

export type CancelKind =
  | "voluntario"            // status=cancelado, payment_type=parcelado
  | "assinatura"            // status=cancelado, payment_type=recorrente
  | "reembolso_gt7"         // status=reembolsado, refund > 7 days from purchase
  | "reembolso_le7"         // status=reembolsado, refund <= 7 days from purchase
  | "chargeback_assinatura" // cancellation_reason = 'chargeback_assinatura'
  | "chargeback_parcelado"; // cancellation_reason = 'chargeback_parcelado'

export const CANCEL_LABELS: Record<CancelKind, string> = {
  voluntario: "Cancelamentos voluntários",
  assinatura: "Assinaturas canceladas",
  // gt7 = cancellation_reason 'reembolso_voluntario' (refund >7 days after purchase)
  reembolso_gt7: "Reembolsos +7 dias",
  // le7 = cancellation_reason 'reembolso_7dias' (refund within 7 days)
  reembolso_le7: "Reembolsos -7 dias",
  chargeback_assinatura: "Chargebacks (assinatura)",
  chargeback_parcelado: "Chargebacks (parcelado)",
};

export const CANCEL_COLORS: Record<CancelKind, string> = {
  voluntario: "#F97316",
  assinatura: "#EF4444",
  reembolso_gt7: "#3B82F6",
  reembolso_le7: "#00E5FF",
  chargeback_assinatura: "#8B5CF6",
  chargeback_parcelado: "#EC4899",
};

/** Treat empty / whitespace strings as null. */
function nz(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function safeParse(v: string | null): Date | null {
  if (!v) return null;
  try {
    const d = parseISO(v);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/** Reference date for monthly grouping — COALESCE(cancellation_date, purchase_date). */
export function cancellationGroupingDate(e: EnrichedEnrollment): string | null {
  return nz(e.cancellation_date) ?? nz(e.purchase_date);
}

export function classifyCancellation(e: EnrichedEnrollment): CancelKind | null {
  const reason = nz(e.cancellation_reason)?.toLowerCase() ?? null;
  // ciclos_completos = pagamento finalizado; não é churn.
  if (reason === "ciclos_completos") return null;
  // Chargebacks — independent of computed status. Use the reason directly.
  if (reason === "chargeback_assinatura") return "chargeback_assinatura";
  if (reason === "chargeback_parcelado") return "chargeback_parcelado";
  // Subscription churn from non-payment — independent of computed status (may be 'expirado').
  if (e.payment_type === "recorrente" && reason === "inadimplencia") return "assinatura";
  if (e.status === "cancelado") {
    if (reason === "voluntario") return "voluntario";
    return "voluntario";
  }
  if (e.status === "reembolsado") {
    if (reason === "reembolso_voluntario") return "reembolso_gt7";
    if (reason === "reembolso_7dias") return "reembolso_le7";
    // Fallback: classify by days between purchase and cancellation_date (or purchase_date).
    const ref = safeParse(nz(e.cancellation_date) ?? nz(e.purchase_date));
    const purchase = safeParse(nz(e.purchase_date));
    if (!ref || !purchase) return "reembolso_le7";
    const days = differenceInCalendarDays(ref, purchase);
    return days > 7 ? "reembolso_gt7" : "reembolso_le7";
  }
  return null;
}

/** How much a single enrollment contributes to its bucket for a given kind. */
function contribution(e: EnrichedEnrollment, kind: CancelKind): number {
  if (kind === "chargeback_assinatura" || kind === "chargeback_parcelado") {
    const n = Number(e.chargeback_count ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 1;
}

export interface MonthlyCancelRow {
  month: string;
  voluntario: number;
  assinatura: number;
  reembolso_gt7: number;
  reembolso_le7: number;
  chargeback_assinatura: number;
  chargeback_parcelado: number;
}

/** Build last-N-months series of cancellations grouped by kind. */
export function buildCancelMonthly(
  enrollments: EnrichedEnrollment[],
  monthsCount = 6,
  today: Date = new Date(),
): MonthlyCancelRow[] {
  const months = Array.from({ length: monthsCount }, (_, i) =>
    startOfMonth(subMonths(today, monthsCount - 1 - i)),
  );

  // Debug: log how many enrollments match each series overall
  const totals = {
    voluntario: 0, assinatura: 0, reembolso_gt7: 0, reembolso_le7: 0,
    chargeback_assinatura: 0, chargeback_parcelado: 0, unclassified: 0,
  };
  for (const e of enrollments) {
    const k = classifyCancellation(e);
    if (k) totals[k] += contribution(e, k);
    else if (e.status === "cancelado" || e.status === "reembolsado") totals.unclassified += 1;
  }
  // eslint-disable-next-line no-console
  console.log("[churn-breakdown] series totals (all-time):", totals, "of", enrollments.length, "enrollments");

  return months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));
    const row: MonthlyCancelRow = {
      month: format(m, "MMM/yy"),
      voluntario: 0,
      assinatura: 0,
      reembolso_gt7: 0,
      reembolso_le7: 0,
      chargeback_assinatura: 0,
      chargeback_parcelado: 0,
    };
    for (const e of enrollments) {
      const kind = classifyCancellation(e);
      if (!kind) continue;
      const d = safeParse(cancellationGroupingDate(e));
      if (!d) continue;
      if (d >= m && d < next) row[kind] += contribution(e, kind);
    }
    return row;
  });
}

export interface CancelKpis {
  cancelamentosMes: number;       // status=cancelado in current month
  reembolsosMes: number;          // status=reembolsado in current month
  reembolsosRapidosMes: number;   // refund within 7 days, in current month
  inadimplenciaMes: number;       // recorrente cancelled (assinatura kind) in current month
}

export function computeCancelKpis(
  enrollments: EnrichedEnrollment[],
  today: Date = new Date(),
): CancelKpis {
  const monthStart = startOfMonth(today);
  const inMonth = (e: EnrichedEnrollment) => {
    const d = safeParse(cancellationGroupingDate(e));
    return !!d && d >= monthStart;
  };
  let cancelamentosMes = 0;
  let reembolsosMes = 0;
  let reembolsosRapidosMes = 0;
  let inadimplenciaMes = 0;
  for (const e of enrollments) {
    const kind = classifyCancellation(e);
    if (!kind || !inMonth(e)) continue;
    if (kind === "voluntario") cancelamentosMes += 1;
    if (kind === "assinatura") {
      cancelamentosMes += 1;
      inadimplenciaMes += 1;
    }
    if (kind === "reembolso_gt7" || kind === "reembolso_le7") reembolsosMes += 1;
    if (kind === "reembolso_le7") reembolsosRapidosMes += 1;
  }
  return { cancelamentosMes, reembolsosMes, reembolsosRapidosMes, inadimplenciaMes };
}

export interface ChurnRateRow {
  month: string;
  rate: number; // percentage 0-100
  exits: number;
  activeStart: number;
}

/**
 * Build last-N-months churn rate series.
 * rate = (total exits in month / active enrollments at start of month) * 100
 */
export function buildChurnRateMonthly(
  enrollments: EnrichedEnrollment[],
  monthsCount = 12,
  today: Date = new Date(),
): ChurnRateRow[] {
  const months = Array.from({ length: monthsCount }, (_, i) =>
    startOfMonth(subMonths(today, monthsCount - 1 - i)),
  );

  return months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));

    let activeStart = 0;
    for (const e of enrollments) {
      const purchase = safeParse(nz(e.purchase_date));
      if (!purchase || purchase > m) continue;
      const exp = safeParse(nz(e.expiration_date));
      if (exp && exp < m) continue;
      const cancelDate = safeParse(nz(e.cancellation_date));
      if (cancelDate && cancelDate < m) continue;
      activeStart += 1;
    }

    let exits = 0;
    for (const e of enrollments) {
      const kind = classifyCancellation(e);
      if (!kind) continue;
      const d = safeParse(cancellationGroupingDate(e));
      if (!d) continue;
      if (d >= m && d < next) exits += contribution(e, kind);
    }

    const rate = activeStart > 0 ? (exits / activeStart) * 100 : 0;
    return {
      month: format(m, "MMM/yy"),
      rate: Math.round(rate * 10) / 10,
      exits,
      activeStart,
    };
  });
}
