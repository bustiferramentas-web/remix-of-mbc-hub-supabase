import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, differenceInCalendarDays } from "date-fns";
import { AuthGate } from "@/components/AuthGate";
import { useMbcData, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/data";
import { statusColor, TMB_LABELS } from "@/lib/status";
import { expertPalette } from "@/lib/expert-filter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronRight, Archive, ArchiveRestore, Pencil, Check, X,
  Users, Clock, AlertTriangle, TrendingDown, Search, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/experts/$expertId/products/$productId")({
  component: () => <AuthGate><ExpertProductDetail /></AuthGate>,
});

const COLORS = ["#B69D66", "#3F8F84", "#4F46E5", "#DB2777", "#10B981"];
const tipStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 12,
  color: "#111827",
  boxShadow: "0 4px 12px -4px rgba(17,24,39,0.08)",
};

function ExpertProductDetail() {
  const { expertId, productId } = Route.useParams();
  const nav = useNavigate();
  const { products, experts, enriched, churn, refresh, loading } = useMbcData();

  const product = products.find((p) => p.id === productId);
  const expert = experts.find((e) => e.id === expertId);
  const palette = expert ? expertPalette(expert.name) : undefined;

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fPay, setFPay] = useState("all");

  const productEnrollments = useMemo(
    () => enriched.filter((e) => e.product_id === productId),
    [enriched, productId],
  );

  const today = new Date();
  const monthStart = startOfMonth(today);

  const totalActive = productEnrollments.filter((e) => e.status === "ativo").length;
  const exp30 = productEnrollments.filter(
    (e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30,
  ).length;
  const enrollmentIdSet = new Set(productEnrollments.map((e) => e.id));
  const churnsThisMonth = churn.filter(
    (c) => enrollmentIdSet.has(c.enrollment_id) && parseISO(c.requested_at) >= monthStart,
  ).length;
  const avgDaysAsStudent = productEnrollments.length === 0
    ? 0
    : Math.round(
        productEnrollments.reduce(
          (sum, e) => sum + Math.max(0, differenceInCalendarDays(today, parseISO(e.purchase_date))),
          0,
        ) / productEnrollments.length,
      );

  const byPayment = (["parcelado", "recorrente", "boleto_tmb"] as const)
    .map((pt) => ({
      name: PAYMENT_LABELS[pt],
      value: productEnrollments.filter((e) => e.payment_type === pt).length,
    }))
    .filter((d) => d.value > 0);

  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(today, 5 - i)));
  const enrollTrend = months.map((m) => {
    const next = startOfMonth(subMonths(m, -1));
    return {
      month: format(m, "MMM"),
      matriculas: productEnrollments.filter((e) => {
        const d = parseISO(e.purchase_date);
        return d >= m && d < next;
      }).length,
    };
  });

  const byStatus = (["ativo", "expirado", "cancelado", "inadimplente"] as const).map((st) => ({
    name: STATUS_LABELS[st],
    value: productEnrollments.filter((e) => e.status === st).length,
  }));

  const expiringSoon = productEnrollments.filter(
    (e) => e.status === "ativo" && e.days_to_expire >= 0 && e.days_to_expire <= 30,
  );
  const tmbAlerts = productEnrollments.filter(
    (e) => e.tmb_status === "em_atraso" || e.tmb_status === "negativado",
  );

  const rows = useMemo(
    () =>
      productEnrollments.filter((e) => {
        if (q && !(e.name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()))) return false;
        if (fStatus !== "all" && e.status !== fStatus) return false;
        if (fPay !== "all" && e.payment_type !== fPay) return false;
        return true;
      }),
    [productEnrollments, q, fStatus, fPay],
  );

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!product || !expert || !palette || product.expert_id !== expert.id) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <div className="rounded-xl border border-border bg-white p-8 text-center">
          <p className="text-foreground font-semibold">Produto não encontrado.</p>
          <Link to="/products" className="text-primary underline mt-3 inline-block">Voltar</Link>
        </div>
      </div>
    );
  }

  const startEdit = () => { setDraftName(product.name); setEditing(true); };
  const saveEdit = async () => {
    const name = draftName.trim();
    if (!name || name === product.name) { setEditing(false); return; }
    await supabase.from("products").update({ name }).eq("id", product.id);
    setEditing(false);
    refresh();
  };
  const toggleArchive = async () => {
    await supabase.from("products").update({ archived: !product.archived }).eq("id", product.id);
    refresh();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/products" className="hover:text-foreground transition-colors">Experts</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/experts/$expertId" params={{ expertId: expert.id }} className="hover:text-foreground transition-colors">
          {expert.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate">{product.name}</span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-border bg-white shadow-sm">
        <div className="px-6 md:px-8 pt-6 pb-6" style={{ background: palette.gradient }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 bg-white/70 hover:bg-white text-[#111827] shrink-0"
                onClick={() => nav({ to: "/experts/$expertId", params: { expertId: expert.id } })}
                title="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                {editing ? (
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditing(false);
                      }}
                      className="h-10 text-2xl font-bold bg-white/90 border-white"
                    />
                    <Button size="sm" className="btn-premium h-9 w-9 p-0" onClick={saveEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 bg-white/60 hover:bg-white" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight text-[#111827] truncate">{product.name}</h1>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${palette.chip}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.accent }} />
                    {expert.name}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    product.archived ? "bg-white/70 text-[#6B7280]" : "bg-white/85 text-emerald-700"
                  }`}>
                    {product.archived ? "Arquivado" : "Ativo"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!editing && (
                <Button variant="ghost" size="sm" className="gap-1.5 bg-white/70 hover:bg-white text-[#111827]" onClick={startEdit}>
                  <Pencil className="h-4 w-4" /> Editar nome
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5 bg-white/70 hover:bg-white text-[#111827]" onClick={toggleArchive}>
                {product.archived ? (
                  <><ArchiveRestore className="h-4 w-4" /> Restaurar</>
                ) : (
                  <><Archive className="h-4 w-4" /> Arquivar</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Users className="h-4 w-4" />} label="Alunos ativos" value={totalActive} accent />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Vencem em 30d" value={exp30} tone="warn" />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Churns no mês" value={churnsThisMonth} tone="bad" />
        <Kpi label="Tempo médio (dias)" value={avgDaysAsStudent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Forma de pagamento">
          {byPayment.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byPayment} dataKey="value" nameKey="name" outerRadius={85} innerRadius={50}>
                  {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Matrículas por mês (últimos 6)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={enrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="matriculas" stroke={palette.accent} strokeWidth={2} dot={{ fill: palette.accent }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Distribuição por status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="value" fill={palette.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertCard
          title="Vencendo em até 30 dias"
          icon={<Clock className="h-4 w-4" />}
          tone="warn"
          count={expiringSoon.length}
          rows={expiringSoon.slice(0, 8).map((e) => ({
            id: e.id, name: e.name, secondary: `vence em ${e.expiration_date}`, badge: `${e.days_to_expire}d`,
          }))}
          onRowClick={(id) => nav({ to: "/students/$id", params: { id } })}
        />
        <AlertCard
          title="TMB em atraso ou negativado"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="bad"
          count={tmbAlerts.length}
          rows={tmbAlerts.slice(0, 8).map((e) => ({
            id: e.id, name: e.name, secondary: e.email, badge: e.tmb_status ? TMB_LABELS[e.tmb_status] : "—",
          }))}
          onRowClick={(id) => nav({ to: "/students/$id", params: { id } })}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Alunos deste produto</h2>
          <p className="text-sm text-muted-foreground">{rows.length} de {productEnrollments.length}</p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Sel value={fStatus} onChange={setFStatus} options={[
            { v: "all", l: "Todos status" },
            { v: "ativo", l: "Ativo" },
            { v: "expirado", l: "Expirado" },
            { v: "cancelado", l: "Cancelado" },
            { v: "reembolsado", l: "Reembolsado" },
            { v: "inadimplente", l: "Inadimplente" },
          ]} />
          <Sel value={fPay} onChange={setFPay} options={[
            { v: "all", l: "Todos pagamentos" },
            { v: "parcelado", l: "Parcelado" },
            { v: "recorrente", l: "Recorrente" },
            { v: "boleto_tmb", l: "Boleto TMB" },
          ]} />
        </div>

        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-secondary">
                <tr>
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-left px-5 py-3">E-mail</th>
                  <th className="text-left px-5 py-3">Pagamento</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Compra</th>
                  <th className="text-left px-5 py-3">Vence</th>
                  <th className="text-left px-5 py-3">TMB</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-secondary/40 cursor-pointer"
                    onClick={() => nav({ to: "/students/$id", params: { id: r.id } })}
                  >
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{PAYMENT_LABELS[r.payment_type]}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${statusColor(r.status)}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{r.purchase_date}</td>
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{r.expiration_date}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.tmb_status ? TMB_LABELS[r.tmb_status] : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">Nenhum aluno encontrado.</td>
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="text-sm font-semibold text-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados ainda</div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
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
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${toneCls}`}>{icon}</span>
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
