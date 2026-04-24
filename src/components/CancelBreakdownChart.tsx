import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CANCEL_COLORS, CANCEL_LABELS, type CancelKind, type MonthlyCancelRow } from "@/lib/churn-breakdown";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  color: "#111827",
  boxShadow: "0 4px 12px -4px rgba(17,24,39,0.08)",
};

type View = "by-type" | "by-channel" | "totals";

interface Props {
  data: MonthlyCancelRow[];
  height?: number;
  /** Optional initial view. */
  defaultView?: View;
}

const SERIES: CancelKind[] = [
  "assinatura",
  "voluntario",
  "chargeback_assinatura",
  "chargeback_parcelado",
  "reembolso_gt7",
  "reembolso_le7",
];

const CANCEL_DESCRIPTIONS: Record<CancelKind, string> = {
  assinatura: "recorrente cancelado por inadimplência",
  voluntario: "aluno pediu cancelamento",
  chargeback_assinatura: "contestação em cobrança recorrente",
  chargeback_parcelado: "contestação em compra parcelada",
  reembolso_gt7: "reembolso solicitado após 7 dias da compra",
  reembolso_le7: "reembolso dentro do prazo de garantia",
};

// Channel grouping
const ASSINATURA_KINDS: CancelKind[] = ["assinatura", "voluntario", "chargeback_assinatura"];
const PARCELADO_KINDS: CancelKind[] = ["reembolso_le7", "reembolso_gt7", "chargeback_parcelado"];

const CHANNEL_COLORS = {
  assinatura: "#EF4444",
  parcelado: "#3B82F6",
};

export function CancelBreakdownChart({ data, height = 260, defaultView = "by-type" }: Props) {
  const [view, setView] = useState<View>(defaultView);

  const channelData = useMemo(
    () =>
      data.map((row) => ({
        month: row.month,
        assinatura: ASSINATURA_KINDS.reduce((s, k) => s + (row[k] ?? 0), 0),
        parcelado: PARCELADO_KINDS.reduce((s, k) => s + (row[k] ?? 0), 0),
      })),
    [data],
  );

  const totalsData = useMemo(() => {
    let running = 0;
    return data.map((row) => {
      const total = SERIES.reduce((s, k) => s + (row[k] ?? 0), 0);
      running += total;
      return { month: row.month, total, acumulado: running };
    });
  }, [data]);

  // Period totals for summary row
  const periodTotals = useMemo(() => {
    const t: Record<CancelKind, number> = {
      assinatura: 0, voluntario: 0, chargeback_assinatura: 0,
      chargeback_parcelado: 0, reembolso_gt7: 0, reembolso_le7: 0,
    };
    for (const row of data) {
      for (const k of SERIES) t[k] += row[k] ?? 0;
    }
    const totalAssinatura = ASSINATURA_KINDS.reduce((s, k) => s + t[k], 0);
    const totalParcelado = PARCELADO_KINDS.reduce((s, k) => s + t[k], 0);
    return { byKind: t, totalAssinatura, totalParcelado, total: totalAssinatura + totalParcelado };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Visualização</span>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as View)}
          variant="outline"
          size="sm"
          className="gap-0"
        >
          <ToggleGroupItem value="by-type" className="text-xs">Por tipo de saída</ToggleGroupItem>
          <ToggleGroupItem value="by-channel" className="text-xs">Assinatura vs Parcelado</ToggleGroupItem>
          <ToggleGroupItem value="totals" className="text-xs">Totais acumulados</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {view === "by-type" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
            <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            {SERIES.map((k, i) => (
              <Bar
                key={k}
                stackId="saidas"
                dataKey={k}
                name={CANCEL_LABELS[k]}
                fill={CANCEL_COLORS[k]}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        ) : view === "by-channel" ? (
          <BarChart data={channelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
            <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            <Bar dataKey="assinatura" name="Assinatura" fill={CHANNEL_COLORS.assinatura} radius={[4, 4, 0, 0]} />
            <Bar dataKey="parcelado" name="Parcelado" fill={CHANNEL_COLORS.parcelado} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <ComposedChart data={totalsData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
            <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tipStyle} />
            <Bar yAxisId="left" dataKey="total" name="Saídas no mês" fill="#6B7280" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="acumulado"
              name="Acumulado"
              stroke="#B69D66"
              strokeWidth={2}
              dot={{ fill: "#B69D66" }}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Legend / labels for by-type view */}
      {view === "by-type" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 px-2 pt-2">
          {SERIES.map((k) => (
            <div key={k} className="flex items-start gap-2 text-xs">
              <span
                className="inline-block h-3 w-3 rounded-sm flex-shrink-0 mt-0.5"
                style={{ background: CANCEL_COLORS[k] }}
                aria-hidden
              />
              <div className="min-w-0">
                <span className="font-medium text-foreground">{CANCEL_LABELS[k]}</span>
                <span className="text-muted-foreground"> — {CANCEL_DESCRIPTIONS[k]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "by-channel" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 px-2 pt-2">
          <div className="flex items-start gap-2 text-xs">
            <span className="inline-block h-3 w-3 rounded-sm flex-shrink-0 mt-0.5" style={{ background: CHANNEL_COLORS.assinatura }} aria-hidden />
            <div className="min-w-0">
              <span className="font-medium text-foreground">Assinatura</span>
              <span className="text-muted-foreground"> — inadimplência + voluntários + chargeback assinatura</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="inline-block h-3 w-3 rounded-sm flex-shrink-0 mt-0.5" style={{ background: CHANNEL_COLORS.parcelado }} aria-hidden />
            <div className="min-w-0">
              <span className="font-medium text-foreground">Parcelado</span>
              <span className="text-muted-foreground"> — reembolsos (≤7d e +7d) + chargeback parcelado</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary totals across the full window */}
      <div className="border-t border-border pt-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
          Totais no período ({data.length} {data.length === 1 ? "mês" : "meses"})
        </div>
        {view === "by-channel" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCell color={CHANNEL_COLORS.assinatura} label="Assinatura" value={periodTotals.totalAssinatura} />
            <SummaryCell color={CHANNEL_COLORS.parcelado} label="Parcelado" value={periodTotals.totalParcelado} />
            <SummaryCell label="Total geral" value={periodTotals.total} bold />
          </div>
        ) : view === "totals" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCell color="#6B7280" label="Total de saídas" value={periodTotals.total} bold />
            <SummaryCell color={CHANNEL_COLORS.assinatura} label="Assinatura" value={periodTotals.totalAssinatura} />
            <SummaryCell color={CHANNEL_COLORS.parcelado} label="Parcelado" value={periodTotals.totalParcelado} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SERIES.map((k) => (
              <SummaryCell key={k} color={CANCEL_COLORS[k]} label={CANCEL_LABELS[k]} value={periodTotals.byKind[k]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ color, label, value, bold }: { color?: string; label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {color && (
        <span className="inline-block h-3 w-3 rounded-sm flex-shrink-0" style={{ background: color }} aria-hidden />
      )}
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`ml-auto tabular-nums ${bold ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
