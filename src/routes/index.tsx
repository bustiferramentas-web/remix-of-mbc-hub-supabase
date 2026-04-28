import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { AuthGate } from "@/components/AuthGate";
import { useMbcData, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/data";
import { statusColor } from "@/lib/status";
import { useExpertFilter } from "@/lib/expert-filter";
import { buildCancelMonthly, buildChurnRateMonthly, computeCancelKpis } from "@/lib/churn-breakdown";
import { CancelBreakdownChart } from "@/components/CancelBreakdownChart";
import { ChurnRateChart } from "@/components/ChurnRateChart";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Users, Clock, Sparkles, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/")({
  component: () => (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  ),
});

const COLORS = ["#B69D66", "#3F8F84", "#4F46E5", "#DB2777", "#10B981"];

function Dashboard() {
  const { experts, products, enriched, churn, loading } = useMbcData();
  const { expertId } = useExpertFilter();
  const [fExpert, setFExpert] = useState("all");
  const [fProduct, setFProduct] = useState("all");
  const [fPay, setFPay] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fTmb, setFTmb] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const filtered = useMemo(() => {
    return enriched.filter((e) => {
      if (expertId && e.expert_id !== expertId) return false;
      if (fExpert !== "all" && e.expert_id !== fExpert) return false;
      if (fProduct !== "all" && e.product_id !== fProduct) return false;
      if (fPay !== "all" && e.payment_type !== fPay) return false;
      if (fStatus !== "all" && e.status !== fStatus) return false;
      if (fTmb !== "all" && e.tmb_status !== fTmb) return false;
      if (fFrom && e.purchase_date < fFrom) return false;
      if (fTo && e.purchase_date > fTo) return false;
      return true;
    });
  }, [enriched, expertId, fExpert, fProduct, fPay, fStatus, fTmb, fFrom, fTo]);

  const productsForExpert = fExpert === "all"
    ? products
    : products.filter((p) => p.expert_id === fExpert);

  const today = new Date();
  const totalActive = filtered.filter((e) => e.status === "ativo").length;
  const exp7 = filtered.filter((e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 7).length;
  const exp30 = filtered.filter((e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30).length;
  const exp60 = filtered.filter((e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 60).length;
  const alerts = filtered.filter((e) => e.status === "inadimplente" || (e.status === "ativo" && e.days_to_expire <= 30 && e.days_to_expire >= 0));
  const communityExpiring30 = filtered.filter((e) => {
    if (!e.is_vitalicio || !e.community_expiration_date) return false;
    const d = (parseISO(e.community_expiration_date).getTime() - today.getTime()) / 86400000;
    return d >= 0 && d <= 30;
  });

  const monthStart = startOfMonth(today);
  const cancelledMonth = filtered.filter((e) =>
    (e.status === "cancelado" || e.status === "reembolsado")
  ).length; // simplification: filtered already

  // Churn metrics this month
  const churnReqMonth = churn.filter((c) => parseISO(c.requested_at) >= monthStart);
  const churnReversed = churnReqMonth.filter((c) => c.status === "revertido").length;
  const churnCompleted = churnReqMonth.filter((c) => c.status === "concluido").length;
  const churnRequested = churnReqMonth.length;
  const netChurnRate = totalActive > 0 ? ((churnCompleted / (totalActive + churnCompleted)) * 100) : 0;

  // Aggregations
  const byExpert = experts.map((ex) => ({
    name: ex.name,
    ativos: filtered.filter((e) => e.expert_id === ex.id && e.status === "ativo").length,
  }));
  const byProduct = products.map((p) => ({
    name: p.name,
    ativos: filtered.filter((e) => e.product_id === p.id && e.status === "ativo").length,
  }));
  const byPayment = (["parcelado", "recorrente", "boleto_tmb"] as const).map((pt) => ({
    name: PAYMENT_LABELS[pt],
    value: filtered.filter((e) => e.payment_type === pt).length,
  })).filter((d) => d.value > 0);
  const byStatus = (["ativo", "expirado", "cancelado", "reembolsado", "inadimplente"] as const).map((st) => ({
    name: STATUS_LABELS[st],
    value: filtered.filter((e) => e.status === st).length,
  })).filter((d) => d.value > 0);

  // Monthly trends (last 6 months)
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(today, 5 - i)));
  const enrollTrend = months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));
    const inMonth = filtered.filter((e) => {
      const d = parseISO(e.purchase_date);
      return d >= m && d < next;
    });
    return {
      month: format(m, "MMM"),
      novas: inMonth.filter((e) => !e.is_renewal).length,
      renovacoes: inMonth.filter((e) => e.is_renewal).length,
    };
  });
  const churnTrend = months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));
    const inMonth = (d: string | null) => d ? (parseISO(d) >= m && parseISO(d) < next) : false;
    return {
      month: format(m, "MMM"),
      solicitado: churn.filter((c) => inMonth(c.requested_at)).length,
      revertido: churn.filter((c) => c.status === "revertido" && inMonth(c.resolved_at)).length,
      concluido: churn.filter((c) => c.status === "concluido" && inMonth(c.resolved_at)).length,
    };
  });

  // Renewal KPIs (current month)
  const enrollmentsThisMonth = filtered.filter((e) => parseISO(e.purchase_date) >= monthStart);
  const renewalsThisMonth = enrollmentsThisMonth.filter((e) => e.is_renewal).length;
  const renewalRate = enrollmentsThisMonth.length === 0
    ? 0
    : Math.round((renewalsThisMonth / enrollmentsThisMonth.length) * 100);

  // Cancellation breakdown (current month KPIs + 12-month series)
  const cancelKpis = computeCancelKpis(filtered, today);
  const cancelMonthly = buildCancelMonthly(filtered, 12, today);
  const churnRateMonthly = buildChurnRateMonthly(filtered, 12, today);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Visão geral em tempo real da operação MBC.</p>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <FSelect label="Expert" value={fExpert} onChange={setFExpert}
          options={[{ v: "all", l: "Todos" }, ...experts.map((e) => ({ v: e.id, l: e.name }))]} />
        <FSelect label="Produto" value={fProduct} onChange={setFProduct}
          options={[{ v: "all", l: "Todos" }, ...productsForExpert.map((p) => ({ v: p.id, l: p.name }))]} />
        <FSelect label="Pagamento" value={fPay} onChange={setFPay}
          options={[
            { v: "all", l: "Todos" },
            { v: "parcelado", l: "Parcelado" },
            { v: "recorrente", l: "Recorrente" },
            { v: "boleto_tmb", l: "Boleto TMB" },
          ]} />
        <FSelect label="Status" value={fStatus} onChange={setFStatus}
          options={[
            { v: "all", l: "Todos" },
            { v: "ativo", l: "Ativo" },
            { v: "expirado", l: "Expirado" },
            { v: "cancelado", l: "Cancelado" },
            { v: "reembolsado", l: "Reembolsado" },
            { v: "inadimplente", l: "Inadimplente" },
          ]} />
        <FSelect label="TMB" value={fTmb} onChange={setFTmb}
          options={[
            { v: "all", l: "Todos" },
            { v: "em_dia", l: "Em dia" },
            { v: "quitado", l: "Quitado" },
            { v: "em_atraso", l: "Em atraso" },
            { v: "negativado", l: "Negativado" },
            { v: "cancelado", l: "Cancelado" },
            { v: "reembolsado", l: "Reembolsado" },
          ]} />
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">De</div>
          <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</div>
          <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="h-9" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Ativos" value={totalActive} accent />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Vencem 7d" value={exp7} tone="warn" />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Vencem 30d" value={exp30} tone="warn" />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Vencem 60d" value={exp60} />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Alertas" value={alerts.length} tone="warn" />
        <Kpi label="Cancel/reemb. mês" value={cancelledMonth} />
        <Kpi label="Churn solic." value={churnRequested} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Net churn" value={`${netChurnRate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Churn revertido (mês)" value={churnReversed} tone="ok" />
        <Kpi label="Churn concluído (mês)" value={churnCompleted} tone="bad" />
        <Kpi label="Total de alunos" value={filtered.length} />
        <Link to="/students" search={{ manual_status: "inadimplente" }} className="block focus:outline-none focus:ring-2 focus:ring-warning/40 rounded-xl">
          <Kpi label="Inadimplentes" value={filtered.filter((e) => e.manual_status === "inadimplente").length} tone="warn" clickable />
        </Link>
        <Kpi label="Comunidade vence 30d" value={communityExpiring30.length} tone="warn" />
        <Kpi label="Vitalícios ativos" value={filtered.filter((e) => e.is_vitalicio && e.status === "ativo").length} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Renovações este mês" value={renewalsThisMonth} tone="ok" />
        <Kpi label="Taxa de renovação" value={`${renewalRate}%`} tone="ok" />
      </div>

      {/* Cancellation breakdown KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Cancelamentos (mês)" value={cancelKpis.cancelamentosMes} tone="bad" />
        <Kpi label="Reembolsos (mês)" value={cancelKpis.reembolsosMes} tone="bad" />
        <Kpi label="Reembolsos ≤ 7d (mês)" value={cancelKpis.reembolsosRapidosMes} tone="warn" />
        <Kpi label="Inadimplência cancelada (mês)" value={cancelKpis.inadimplenciaMes} tone="warn" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Alunos ativos por expert">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byExpert}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="ativos" fill="#B69D66" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Alunos ativos por produto">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byProduct}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="ativos" fill="#B69D66" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição por forma de pagamento">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byPayment} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição por status">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Novas matrículas por mês">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={enrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="novas" stroke="#B69D66" strokeWidth={2} dot={{ fill: "#B69D66" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Renovações por mês">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={enrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="renovacoes" fill="#3F8F84" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard
            title="Visão geral de saídas"
            info="Contabiliza saídas por mês de cancelamento. Chargebacks de assinatura contam por evento."
          >
            <CancelBreakdownChart data={cancelMonthly} height={350} />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard
            title="Taxa de Churn Mensal (%)"
            info="(Total de saídas no mês ÷ alunos ativos no início do mês) × 100. A linha tracejada indica a média do período."
          >
            <ChurnRateChart data={churnRateMonthly} height={320} />
          </ChartCard>
        </div>
      </div>

      {/* Alert panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <h3 className="font-semibold">Alunos em alerta</h3>
          <Badge variant="secondary" className="ml-2">{alerts.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-3">Aluno</th>
                <th className="text-left px-5 py-3">Produto</th>
                <th className="text-left px-5 py-3">Pagamento</th>
                <th className="text-left px-5 py-3">TMB</th>
                <th className="text-left px-5 py-3">Vence em</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 20).map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to="/students/$id" params={{ id: a.id }} className="text-foreground hover:text-primary">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.product_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{PAYMENT_LABELS[a.payment_type]}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.tmb_status ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{a.expiration_date}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${statusColor(a.status)}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhum alerta no momento.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Community expiration panel */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold">Comunidade vencendo em 30 dias</h3>
          <Badge variant="secondary" className="ml-2">{communityExpiring30.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-3">Aluno</th>
                <th className="text-left px-5 py-3">Produto</th>
                <th className="text-left px-5 py-3">Comunidade vence</th>
              </tr>
            </thead>
            <tbody>
              {communityExpiring30.slice(0, 20).map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link to="/students/$id" params={{ id: a.id }} className="text-foreground hover:text-primary">{a.name}</Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.product_name}</td>
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{a.community_expiration_date}</td>
                </tr>
              ))}
              {communityExpiring30.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground text-sm">Nenhuma comunidade vencendo em 30 dias.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  color: "#111827",
  boxShadow: "0 4px 12px -4px rgba(17,24,39,0.08)",
};

function FSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Kpi({ label, value, icon, accent, tone, clickable }: {
  label: string; value: number | string; icon?: React.ReactNode;
  accent?: boolean; tone?: "ok" | "warn" | "bad"; clickable?: boolean;
}) {
  const toneCls = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "";
  const interactive = clickable ? "cursor-pointer transition-all hover:shadow-md hover:border-warning/50 hover:-translate-y-0.5" : "";
  return (
    <div className={`rounded-xl border bg-card p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border"} ${interactive}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
        {title}
        {info && (
          <TooltipProvider delayDuration={150}>
            <UITooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Mais informações">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{info}</TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
      </h3>
      {children}
    </div>
  );
}
