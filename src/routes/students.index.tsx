import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { AuthGate } from "@/components/AuthGate";
import { useMbcData, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/data";
import type { EnrichedEnrollment } from "@/lib/data";
import { statusColor, TMB_LABELS, daysToCommunityExpire } from "@/lib/status";
import { useExpertFilter } from "@/lib/expert-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Sparkles, Download, FileSpreadsheet, FileText } from "lucide-react";
import { NewEnrollmentDialog } from "@/components/NewEnrollmentDialog";

type StudentsSearch = { manual_status?: "inadimplente" };

export const Route = createFileRoute("/students/")({
  validateSearch: (search: Record<string, unknown>): StudentsSearch => {
    return search.manual_status === "inadimplente" ? { manual_status: "inadimplente" } : {};
  },
  component: () => <AuthGate><StudentsList /></AuthGate>,
});

const EXPORT_COLUMNS: { key: string; header: string; get: (r: EnrichedEnrollment) => string | number | null }[] = [
  { key: "name", header: "Nome", get: (r) => r.name },
  { key: "email", header: "E-mail", get: (r) => r.email },
  { key: "phone", header: "Telefone", get: (r) => r.phone ?? "" },
  { key: "expert", header: "Expert", get: (r) => r.expert_name },
  { key: "product", header: "Produto", get: (r) => r.product_name },
  { key: "payment_type", header: "Pagamento", get: (r) => PAYMENT_LABELS[r.payment_type] ?? r.payment_type },
  { key: "status", header: "Status", get: (r) => STATUS_LABELS[r.status] ?? r.status },
  { key: "purchase_date", header: "Data de compra", get: (r) => r.purchase_date ?? "" },
  { key: "expiration_date", header: "Vencimento", get: (r) => r.expiration_date ?? "" },
  { key: "community_expiration_date", header: "Vencimento comunidade", get: (r) => r.community_expiration_date ?? "" },
  { key: "last_payment_date", header: "Último pagamento", get: (r) => r.last_payment_date ?? "" },
  { key: "cancellation_date", header: "Data de cancelamento", get: (r) => r.cancellation_date ?? "" },
  { key: "cancellation_reason", header: "Motivo do cancelamento", get: (r) => r.cancellation_reason ?? "" },
  { key: "chargeback_count", header: "Chargebacks", get: (r) => r.chargeback_count ?? 0 },
  { key: "is_vitalicio", header: "Vitalício", get: (r) => (r.is_vitalicio ? "Sim" : "Não") },
  { key: "is_renewal", header: "Renovação", get: (r) => (r.is_renewal ? "Sim" : "Não") },
  { key: "notes", header: "Notas", get: (r) => r.notes ?? "" },
];

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "alunos";
}

function buildExportRows(rows: EnrichedEnrollment[]): (string | number)[][] {
  const header = EXPORT_COLUMNS.map((c) => c.header);
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => {
    const v = c.get(r);
    return v === null || v === undefined ? "" : v;
  }));
  return [header, ...body];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(rows: EnrichedEnrollment[], filename: string) {
  const data = buildExportRows(rows);
  const csv = data.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  // UTF-8 BOM for Excel accent compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

function exportXlsx(rows: EnrichedEnrollment[], filename: string, sheetName: string) {
  const data = buildExportRows(rows);
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Auto-fit column widths based on the longest cell value (capped).
  const colWidths = EXPORT_COLUMNS.map((_, colIdx) => {
    const maxLen = data.reduce((m, row) => {
      const s = row[colIdx] === undefined || row[colIdx] === null ? "" : String(row[colIdx]);
      return Math.max(m, s.length);
    }, 0);
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  // Excel sheet names: max 31 chars, no special chars
  const safeSheet = sheetName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Alunos";
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  XLSX.writeFile(wb, filename);
}

function StudentsList() {
  const { enriched, experts, products, loading, refresh } = useMbcData();
  const { expertId } = useExpertFilter();
  const { manual_status: manualStatusFilter } = Route.useSearch();
  const [q, setQ] = useState("");
  const [fExpert, setFExpert] = useState("all");
  const [fProduct, setFProduct] = useState("all");
  const [fPay, setFPay] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fExp, setFExp] = useState("all");
  const [open, setOpen] = useState(false);

  const productsForExpert = fExpert === "all" ? products : products.filter((p) => p.expert_id === fExpert);

  const rows = useMemo(() => enriched.filter((e) => {
    if (manualStatusFilter === "inadimplente" && e.manual_status !== "inadimplente") return false;
    if (expertId && e.expert_id !== expertId) return false;
    if (q && !(e.name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()))) return false;
    if (fExpert !== "all" && e.expert_id !== fExpert) return false;
    if (fProduct !== "all" && e.product_id !== fProduct) return false;
    if (fPay !== "all" && e.payment_type !== fPay) return false;
    if (fStatus !== "all" && e.status !== fStatus) return false;
    if (fExp !== "all") {
      const d = e.days_to_expire;
      if (fExp === "expired" && d >= 0) return false;
      if (fExp === "15" && !(d >= 0 && d <= 15)) return false;
      if (fExp === "30" && !(d >= 0 && d <= 30)) return false;
      if (fExp === "60" && !(d >= 0 && d <= 60)) return false;
    }
    return true;
  }), [enriched, expertId, q, fExpert, fProduct, fPay, fStatus, fExp, manualStatusFilter]);

  const exportContext = useMemo(() => {
    const product = fProduct !== "all" ? products.find((p) => p.id === fProduct) : null;
    const productLabel = product ? slugify(product.name) : "todos";
    const sheetName = product ? product.name : "Todos os alunos";
    const baseFilename = `alunos_${productLabel}_${format(new Date(), "yyyy-MM-dd")}`;
    return { baseFilename, sheetName };
  }, [fProduct, products]);

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="page-subtitle">{rows.length} de {enriched.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 h-10 px-4" disabled={rows.length === 0}>
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => exportCsv(rows, `${exportContext.baseFilename}.csv`)} className="gap-2">
                <FileText className="h-4 w-4" /> Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportXlsx(rows, `${exportContext.baseFilename}.xlsx`, exportContext.sheetName)} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setOpen(true)} className="btn-premium gap-2 h-10 px-5"><Plus className="h-4 w-4" /> Nova matrícula</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Sel value={fExpert} onChange={setFExpert} options={[{ v: "all", l: "Todos experts" }, ...experts.map((e) => ({ v: e.id, l: e.name }))]} />
        <Sel value={fProduct} onChange={setFProduct} options={[{ v: "all", l: "Todos produtos" }, ...productsForExpert.map((p) => ({ v: p.id, l: p.name }))]} />
        <Sel value={fPay} onChange={setFPay} options={[
          { v: "all", l: "Todos pagamentos" },
          { v: "parcelado", l: "Parcelado" },
          { v: "recorrente", l: "Recorrente" },
          { v: "boleto_tmb", l: "Boleto TMB" },
        ]} />
        <Sel value={fStatus} onChange={setFStatus} options={[
          { v: "all", l: "Todos status" },
          { v: "ativo", l: "Ativo" }, { v: "expirado", l: "Expirado" },
          { v: "cancelado", l: "Cancelado" }, { v: "reembolsado", l: "Reembolsado" },
          { v: "inadimplente", l: "Inadimplente" },
        ]} />
        <Sel value={fExp} onChange={setFExp} options={[
          { v: "all", l: "Todos vencimentos" },
          { v: "15", l: "Vencendo em 15 dias" },
          { v: "30", l: "Vencendo em 30 dias" },
          { v: "60", l: "Vencendo em 60 dias" },
          { v: "expired", l: "Já expirado" },
        ]} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">E-mail</th>
                <th className="text-left px-5 py-3">Produto</th>
                <th className="text-left px-5 py-3">Expert</th>
                <th className="text-left px-5 py-3">Pagamento</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Vence</th>
                <th className="text-left px-5 py-3">TMB</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && rows.map((r) => {
                const commDays = daysToCommunityExpire(r);
                const commWarn = commDays !== null && commDays >= 0 && commDays <= 60;
                return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link to="/students/$id" params={{ id: r.id }} className="font-medium hover:text-primary">{r.name}</Link>
                      {r.is_vitalicio && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          <Sparkles className="h-2.5 w-2.5" /> Vitalício
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.email}</td>
                  <td className="px-5 py-3">{r.product_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.expert_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{PAYMENT_LABELS[r.payment_type]}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${statusColor(r.status)}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">
                    {r.is_vitalicio
                      ? (commWarn ? <span className="text-amber-600">Comunidade vence em {commDays}d</span> : "—")
                      : (r.expiration_date ?? "—")}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.tmb_status ? TMB_LABELS[r.tmb_status] : "—"}</td>
                </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">Nenhum aluno encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewEnrollmentDialog open={open} onOpenChange={setOpen} experts={experts} products={products} onCreated={refresh} />
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
