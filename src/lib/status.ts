import { addDays, addMonths, addYears, differenceInCalendarDays, parseISO } from "date-fns";

export type PaymentType = "parcelado" | "recorrente" | "boleto_tmb";
export type TmbStatus =
  | "em_dia"
  | "quitado"
  | "em_atraso"
  | "negativado"
  | "cancelado"
  | "reembolsado";
export type ManualStatus = "cancelado" | "reembolsado" | "inadimplente" | null;
export type ComputedStatus =
  | "ativo"
  | "expirado"
  | "cancelado"
  | "reembolsado"
  | "inadimplente";

export interface EnrollmentLike {
  payment_type: PaymentType;
  purchase_date: string; // ISO date
  expiration_date: string | null;
  last_payment_date: string | null;
  tmb_status: TmbStatus | null;
  manual_status: ManualStatus;
  is_vitalicio?: boolean;
  community_expiration_date?: string | null;
  cancellation_reason?: string | null;
}

const toDate = (d: string) => parseISO(d);

export function computeExpiration(
  payment_type: PaymentType,
  purchase_date: string,
): string {
  // default expiration = purchase + 1y for all types
  return addYears(toDate(purchase_date), 1).toISOString().slice(0, 10);
}

export function computeCommunityExpiration(purchase_date: string): string {
  return addYears(toDate(purchase_date), 2).toISOString().slice(0, 10);
}

export function computeStatus(e: EnrollmentLike, today: Date = new Date()): ComputedStatus {
  // ciclos_completos = pagamento finalizado normalmente; nunca conta como cancelamento
  const isCiclosCompletos = (e.cancellation_reason ?? "").trim().toLowerCase() === "ciclos_completos";
  if (e.manual_status === "cancelado" && !isCiclosCompletos) return "cancelado";
  if (e.manual_status === "reembolsado") return "reembolsado";
  if (e.manual_status === "inadimplente") return "inadimplente";

  // Vitalício: content never expires; TMB still applies for boleto
  if (e.is_vitalicio) {
    if (e.payment_type === "boleto_tmb") {
      if (e.tmb_status === "cancelado") return "cancelado";
      if (e.tmb_status === "reembolsado") return "reembolsado";
      if (e.tmb_status === "em_atraso" || e.tmb_status === "negativado") return "inadimplente";
    }
    return "ativo";
  }

  if (!e.expiration_date) return "ativo";
  const expDate = toDate(e.expiration_date);

  if (e.payment_type === "parcelado") {
    return expDate > today ? "ativo" : "expirado";
  }
  if (e.payment_type === "recorrente") {
    if (!e.last_payment_date) return "expirado";
    const nextDue = addMonths(toDate(e.last_payment_date), 1);
    if (expDate <= today) return "expirado";
    return nextDue > today ? "ativo" : "expirado";
  }
  // boleto_tmb
  if (e.tmb_status === "cancelado") return "cancelado";
  if (e.tmb_status === "reembolsado") return "reembolsado";
  if (e.tmb_status === "em_atraso" || e.tmb_status === "negativado") return "inadimplente";
  return expDate > today ? "ativo" : "expirado";
}

export function daysToExpire(e: EnrollmentLike, today: Date = new Date()): number {
  if (!e.expiration_date) return Number.POSITIVE_INFINITY;
  return differenceInCalendarDays(toDate(e.expiration_date), today);
}

export function daysToCommunityExpire(e: EnrollmentLike, today: Date = new Date()): number | null {
  if (!e.is_vitalicio || !e.community_expiration_date) return null;
  return differenceInCalendarDays(toDate(e.community_expiration_date), today);
}

export function statusColor(s: ComputedStatus): string {
  switch (s) {
    case "ativo": return "bg-success/15 text-success border-success/30";
    case "expirado": return "bg-muted text-muted-foreground border-border";
    case "cancelado": return "bg-destructive/15 text-destructive border-destructive/30";
    case "reembolsado": return "bg-destructive/10 text-destructive border-destructive/20";
    case "inadimplente": return "bg-warning/15 text-warning border-warning/30";
  }
}

export const PAYMENT_LABELS: Record<PaymentType, string> = {
  parcelado: "Parcelado",
  recorrente: "Recorrente",
  boleto_tmb: "Boleto TMB",
};

export const TMB_LABELS: Record<TmbStatus, string> = {
  em_dia: "Em dia",
  quitado: "Quitado",
  em_atraso: "Em atraso",
  negativado: "Negativado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
};

export const STATUS_LABELS: Record<ComputedStatus, string> = {
  ativo: "Ativo",
  expirado: "Expirado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
  inadimplente: "Inadimplente",
};

export { addDays };
