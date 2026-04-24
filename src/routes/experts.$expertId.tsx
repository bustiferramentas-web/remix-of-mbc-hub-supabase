import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { AuthGate } from "@/components/AuthGate";
import { useMbcData, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/data";
import { statusColor, TMB_LABELS } from "@/lib/status";
import { expertPalette } from "@/lib/expert-filter";
import { buildCancelMonthly, buildChurnRateMonthly, computeCancelKpis } from "@/lib/churn-breakdown";
import { CancelBreakdownChart } from "@/components/CancelBreakdownChart";
import { ChurnRateChart } from "@/components/ChurnRateChart";
import { Users, Clock, AlertTriangle, TrendingDown, Repeat, Package, ChevronRight, Info } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/experts/$expertId")({
  component: () => <AuthGate><ExpertWorkspace /></AuthGate>,
});

const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  color: "#111827",
  boxShadow: "0 4px 12px -4px rgba(17,24,39,0.08)",
};

const PIE_COLORS = ["#B69D66", "#3F8F84", "#4F46E5", "#DB2777", "#10B981"];

function ExpertWorkspace() {
  const { expertId } = Route.useParams();
  const nav = useNavigate();
  const { experts, products, enriched, churn, loading } = useMbcData();

  const expert = experts.find((e) => e.id === expertId);
  const palette = expert ? expertPalette(expert.name) : undefined;

  const expertProducts = useMemo(
    () => products.filter((p) => p.expert_id === expertId),
    [products, expertId],
  );
  const productIds = useMemo(() => new Set(expertProducts.map((p) => p.id)), [expertProducts]);

  const [productFilter, setProductFilter] = useState<string | null>(null);

  // All enrollments for this expert (used for product card stats — those should not be filtered)
  const allExpertEnrollments = useMemo(
    () => enriched.filter((e) => productIds.has(e.product_id)),
    [enriched, productIds],
  );
  // Filtered view powering KPIs, charts, alerts, recent table
  const expertEnrollments = useMemo(
    () => productFilter
      ? allExpertEnrollments.filter((e) => e.product_id === productFilter)
      : allExpertEnrollments,
    [allExpertEnrollments, productFilter],
  );

  const today = new Date();
  const monthStart = startOfMonth(today);
  const enrollmentIds = new Set(expertEnrollments.map((e) => e.id));
  const expertChurns = churn.filter((c) => enrollmentIds.has(c.enrollment_id));
  const allEnrollmentIds = new Set(allExpertEnrollments.map((e) => e.id));
  const allExpertChurns = churn.filter((c) => allEnrollmentIds.has(c.enrollment_id));

  // KPIs
  const totalActive = expertEnrollments.filter((e) => e.status === "ativo").length;
  const exp30 = expertEnrollments.filter(
    (e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30,
  ).length;
  const alerts = expertEnrollments.filter(
    (e) => e.status === "inadimplente" || e.tmb_status === "em_atraso" || e.tmb_status === "negativado",
  ).length;
  const churnsThisMonth = expertChurns.filter((c) => parseISO(c.requested_at) >= monthStart).length;
  const reverted = expertChurns.filter((c) => c.status === "revertido").length;
  const totalChurns = expertChurns.length;
  const reversalRate = totalChurns === 0 ? 0 : Math.round((reverted / totalChurns) * 100);

  // Chart: students per product
  const studentsPerProduct = expertProducts.map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    ativos: expertEnrollments.filter((e) => e.product_id === p.id && e.status === "ativo").length,
  }));

  // Chart: monthly enrollments trend (split: novas vs renovações)
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(today, 5 - i)));
  const trend = months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));
    const inMonth = expertEnrollments.filter((e) => {
      const d = parseISO(e.purchase_date);
      return d >= m && d < next;
    });
    return {
      month: format(m, "MMM"),
      novas: inMonth.filter((e) => !e.is_renewal).length,
      renovacoes: inMonth.filter((e) => e.is_renewal).length,
    };
  });

  // Chart: status pie
  const byStatus = (["ativo", "expirado", "cancelado", "inadimplente"] as const).map((st) => ({
    name: STATUS_LABELS[st],
    value: expertEnrollments.filter((e) => e.status === st).length,
  })).filter((d) => d.value > 0);

  // Chart: payment pie
  const byPayment = (["parcelado", "recorrente", "boleto_tmb"] as const).map((pt) => ({
    name: PAYMENT_LABELS[pt],
    value: expertEnrollments.filter((e) => e.payment_type === pt).length,
  })).filter((d) => d.value > 0);

  // Cancellation breakdown (current month + 12-month series)
  const cancelKpis = computeCancelKpis(expertEnrollments, today);
  const cancelMonthly = buildCancelMonthly(expertEnrollments, 12, today);
  const churnRateMonthly = buildChurnRateMonthly(expertEnrollments, 12, today);

  // Alerts
  const expiringSoon = expertEnrollments.filter(
    (e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30,
  );
  const tmbAlerts = expertEnrollments.filter(
    (e) => e.tmb_status === "em_atraso" || e.tmb_status === "negativado",
  );

  // Recent enrollments
  const recent = [...expertEnrollments]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!expert || !palette) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <div className="rounded-xl border border-border bg-white p-8 text-center">
          <p className="text-foreground font-semibold">Expert não encontrado.</p>
          <Link to="/products" className="text-primary underline mt-3 inline-block">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/products" className="hover:text-foreground transition-colors">Experts</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{expert.name}</span>
      </div>

      {/* Header banner */}
      <div className="rounded-2xl overflow-hidden border border-border bg-white shadow-sm">
        <div className="px-6 md:px-8 py-7" style={{ background: palette.gradient }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow"
              style={{ background: palette.accent }}
            >
              {expert.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight text-[#111827] truncate">
                {expert.name}
              </h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${palette.chip}`}>
                  <Package className="h-3 w-3" />
                  {expertProducts.filter((p) => !p.archived).length} produtos ativos
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/85 text-[#111827]">
                  {allExpertEnrollments.length} matrículas totais
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product filter pills */}
      {expertProducts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Pill
            active={productFilter === null}
            accent={palette.accent}
            onClick={() => setProductFilter(null)}
          >
            Todos os produtos
          </Pill>
          {expertProducts.map((p) => (
            <Pill
              key={p.id}
              active={productFilter === p.id}
              accent={palette.accent}
              onClick={() => setProductFilter(p.id)}
            >
              {p.name}
            </Pill>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Alunos ativos" value={totalActive} accent />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Vencem em 30d" value={exp30} tone="warn" />
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Alertas" value={alerts} tone="warn" />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Churns no mês" value={churnsThisMonth} tone="bad" />
        <Kpi icon={<Repeat className="h-4 w-4" />} label="Taxa de reversão" value={`${reversalRate}%`} tone="ok" />
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
        <ChartCard title="Alunos ativos por produto">
          {studentsPerProduct.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={studentsPerProduct}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="ativos" fill={palette.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Novas matrículas por mês (últimos 6)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="novas" stroke={palette.accent} strokeWidth={2} dot={{ fill: palette.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Renovações por mês (últimos 6)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="renovacoes" fill={palette.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição por status">
          {byStatus.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={85} innerRadius={50}>
                  {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Forma de pagamento">
          {byPayment.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byPayment} dataKey="value" nameKey="name" outerRadius={85} innerRadius={50}>
                  {byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
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

      {/* Products grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Produtos</h2>
        {expertProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-muted-foreground text-sm">
            Nenhum produto cadastrado para este expert.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expertProducts.map((p) => {
              const pe = allExpertEnrollments.filter((e) => e.product_id === p.id);
              const ativos = pe.filter((e) => e.status === "ativo").length;
              const vence = pe.filter((e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30).length;
              const ch = allExpertChurns.filter((c) => pe.some((e) => e.id === c.enrollment_id)).length;
              return (
                <Link
                  key={p.id}
                  to="/experts/$expertId/products/$productId"
                  params={{ expertId: expert.id, productId: p.id }}
                  className="group rounded-xl border border-border bg-white p-4 hover:shadow-md transition-shadow block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate group-hover:text-[#111827]">
                        {p.name}
                      </div>
                      {p.archived && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Arquivado</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <MiniStat label="Ativos" value={ativos} />
                    <MiniStat label="Vencem 30d" value={vence} tone="warn" />
                    <MiniStat label="Churns" value={ch} tone="bad" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertCard
          title="Vencendo em até 30 dias"
          icon={<Clock className="h-4 w-4" />}
          tone="warn"
          count={expiringSoon.length}
          rows={expiringSoon.slice(0, 8).map((e) => ({
            id: e.id,
            name: e.name,
            secondary: `${e.product_name} · vence em ${e.expiration_date}`,
            badge: `${e.days_to_expire}d`,
          }))}
          onRowClick={(id) => nav({ to: "/students/$id", params: { id } })}
        />
        <AlertCard
          title="TMB em atraso ou negativado"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="bad"
          count={tmbAlerts.length}
          rows={tmbAlerts.slice(0, 8).map((e) => ({
            id: e.id,
            name: e.name,
            secondary: e.product_name,
            badge: e.tmb_status ? TMB_LABELS[e.tmb_status] : "—",
          }))}
          onRowClick={(id) => nav({ to: "/students/$id", params: { id } })}
        />
      </div>

      {/* Recent enrollments */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Últimas matrículas</h2>
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-secondary">
                <tr>
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-left px-5 py-3">Produto</th>
                  <th className="text-left px-5 py-3">Pagamento</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Compra</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    onClick={() => nav({ to: "/students/$id", params: { id: r.id } })}
                  >
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.product_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{PAYMENT_LABELS[r.payment_type]}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${statusColor(r.status)}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{r.purchase_date}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      Nenhuma matrícula ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ active, accent, onClick, children }: {
  active: boolean; accent: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
        active
          ? "text-white border-transparent shadow-sm"
          : "bg-white text-foreground border-border hover:border-foreground/30"
      }`}
      style={active ? { background: accent } : undefined}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, icon, accent, tone }: {
  label: string; value: number | string; icon?: React.ReactNode;
  accent?: boolean; tone?: "ok" | "warn" | "bad";
}) {
  const toneCls = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className={`rounded-xl border bg-white p-4 ${accent ? "border-foreground/20" : "border-border"}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
        {icon}{label}
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
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
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
      Sem dados ainda
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  const cls = tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg bg-secondary/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function AlertCard({
  title, icon, tone, count, rows, onRowClick,
}: {
  title: string; icon: React.ReactNode; tone: "warn" | "bad"; count: number;
  rows: { id: string; name: string; secondary: string; badge: string }[];
  onRowClick?: (id: string) => void;
}) {
  const toneCls = tone === "warn" ? "text-amber-600 bg-amber-50 border-amber-200" : "text-red-600 bg-red-50 border-red-200";
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${toneCls}`}>
            {icon}
          </span>
          {title}
        </div>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum alerta.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-secondary/40 cursor-pointer"
              onClick={() => onRowClick?.(r.id)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">{r.secondary}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${toneCls}`}>{r.badge}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
