import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, CheckCircle2, AlertCircle, FileText, Trash2, History, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMbcData } from "@/lib/data";
import { computeExpiration, computeCommunityExpiration, type PaymentType, type TmbStatus } from "@/lib/status";

type ManualStatus = "cancelado" | "reembolsado" | "inadimplente";
const MANUAL_STATUS_VALID: ManualStatus[] = ["cancelado", "reembolsado", "inadimplente"];

export const Route = createFileRoute("/import")({
  component: () => <AuthGate><ImportPage /></AuthGate>,
});

interface ParsedRow {
  _row: number;
  name: string;
  email: string;
  phone: string | null;
  payment_type: PaymentType;
  purchase_date: string;
  is_vitalicio: boolean;
  community_expiration_date: string | null;
  last_payment_date: string | null;
  tmb_status: TmbStatus | null;
  notes: string | null;
  is_renewal: boolean;
  manual_status: ManualStatus | null;
  cancellation_date: string | null;
  cancellation_reason: string | null;
  chargeback_count: number;
  _errors: string[];
}

interface ImportError {
  row: number;
  name: string;
  email: string;
  reason: string;
}

interface ImportLogRow {
  id: string;
  imported_at: string;
  product_id: string | null;
  expert_id: string | null;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: string;
  imported_by: string | null;
}

const EXPECTED_COLUMNS = [
  "name", "email", "phone", "payment_type", "purchase_date",
  "is_vitalicio", "community_expiration_date", "last_payment_date",
  "tmb_status", "notes", "is_renewal",
  "manual_status", "cancellation_date", "cancellation_reason", "chargeback_count",
];

const PAYMENT_VALID: PaymentType[] = ["parcelado", "recorrente", "boleto_tmb"];
const TMB_VALID: TmbStatus[] = ["em_dia", "quitado", "em_atraso", "negativado", "cancelado", "reembolsado"];

function parseBool(v: string): boolean {
  const s = (v || "").toLowerCase().trim();
  return s === "sim" || s === "true" || s === "1" || s === "yes";
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

function ImportPage() {
  const { experts, products, refresh } = useMbcData();
  const { user } = useAuth();
  const [expertId, setExpertId] = useState("");
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; errors: ImportError[] } | null>(null);

  const [logs, setLogs] = useState<ImportLogRow[]>([]);
  const [editedMap, setEditedMap] = useState<Record<string, boolean>>({});
  const [logsRefresh, setLogsRefresh] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<ImportLogRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const doWipe = async () => {
    setWiping(true);
    const { error: e1 } = await supabase.from("enrollments").delete().not("id", "is", null);
    const { error: e2 } = await supabase.from("imports").delete().not("id", "is", null);
    setWiping(false);
    setConfirmWipe(false);
    if (e1 || e2) {
      toast.error("Erro ao limpar dados", { description: (e1 || e2)?.message });
      return;
    }
    toast.success("Todos os dados foram removidos com sucesso");
    setLogsRefresh((k) => k + 1);
    refresh();
  };

  const productList = useMemo(
    () => expertId ? products.filter((p) => p.expert_id === expertId) : [],
    [expertId, products],
  );
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const expertMap = useMemo(() => new Map(experts.map((e) => [e.id, e.name])), [experts]);

  const validRows = rows.filter((r) => r._errors.length === 0);
  const invalidRows = rows.filter((r) => r._errors.length > 0);

  // Load history + edited flags
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("imports")
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const logRows = (data ?? []) as ImportLogRow[];
      setLogs(logRows);

      // Detect manual edits per import
      if (logRows.length > 0) {
        const ids = logRows.map((l) => l.id);
        const { data: edited } = await supabase
          .from("enrollments")
          .select("import_id")
          .in("import_id", ids)
          .eq("manually_edited", true);
        const map: Record<string, boolean> = {};
        (edited ?? []).forEach((r: { import_id: string | null }) => {
          if (r.import_id) map[r.import_id] = true;
        });
        if (!cancelled) setEditedMap(map);
      } else {
        setEditedMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [logsRefresh]);

  const onFile = (file: File) => {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const parsed: ParsedRow[] = res.data.map((raw, idx) => {
          const errors: string[] = [];
          const name = (raw.name || "").trim();
          const email = (raw.email || "").trim();
          const purchase_date = (raw.purchase_date || "").trim();
          const payment_type_raw = (raw.payment_type || "parcelado").trim().toLowerCase() as PaymentType;
          const is_vitalicio = parseBool(raw.is_vitalicio || "");
          const is_renewal = parseBool(raw.is_renewal || "");
          const community_raw = (raw.community_expiration_date || "").trim();
          const last_pay = (raw.last_payment_date || "").trim();
          const tmb_raw = (raw.tmb_status || "").trim().toLowerCase() as TmbStatus;
          // Accept "manual_status" or "status" column from CSV; normalize common synonyms
          const manual_raw_in = (raw.manual_status || raw.status || "").trim().toLowerCase();
          const manual_raw =
            manual_raw_in === "canceled" || manual_raw_in === "cancelled" || manual_raw_in === "cancelada"
              ? "cancelado"
              : manual_raw_in === "refunded" || manual_raw_in === "reembolso" || manual_raw_in === "reembolsada"
              ? "reembolsado"
              : manual_raw_in;
          const cancel_date_raw = (raw.cancellation_date || raw.refund_date || raw.cancelled_at || raw.canceled_at || "").trim();
          const cancel_reason_raw = (raw.cancellation_reason || "").trim();
          const chargeback_raw = (raw.chargeback_count || "").trim();
          const chargeback_count = chargeback_raw === "" ? 0 : Math.max(0, parseInt(chargeback_raw, 10) || 0);

          if (!name) errors.push("nome vazio");
          if (!email) errors.push("e-mail vazio");
          if (!isValidDate(purchase_date)) errors.push("purchase_date inválida");
          if (!PAYMENT_VALID.includes(payment_type_raw)) errors.push(`payment_type inválido: ${payment_type_raw}`);
          if (community_raw && !isValidDate(community_raw)) errors.push("community_expiration_date inválida");
          if (last_pay && !isValidDate(last_pay)) errors.push("last_payment_date inválida");
          if (tmb_raw && !TMB_VALID.includes(tmb_raw)) errors.push(`tmb_status inválido: ${tmb_raw}`);
          // Values like "ativo"/"expirado"/"inadimplente" are computed states — ignore (no manual override)
          const COMPUTED_STATES = ["ativo", "expirado", "inadimplente", "active", "expired"];
          const isComputed = COMPUTED_STATES.includes(manual_raw);
          if (manual_raw && !isComputed && !MANUAL_STATUS_VALID.includes(manual_raw as ManualStatus)) {
            errors.push(`manual_status inválido: ${manual_raw}`);
          }
          if (cancel_date_raw && !isValidDate(cancel_date_raw)) errors.push("cancellation_date inválida");

          const manual_status: ManualStatus | null =
            !isComputed && manual_raw && MANUAL_STATUS_VALID.includes(manual_raw as ManualStatus)
              ? (manual_raw as ManualStatus)
              : null;
          // If marked cancelled/refunded but no cancellation_date provided, fall back to purchase_date
          const cancellation_date = manual_status
            ? (cancel_date_raw && isValidDate(cancel_date_raw) ? cancel_date_raw : (isValidDate(purchase_date) ? purchase_date : null))
            : (cancel_date_raw && isValidDate(cancel_date_raw) ? cancel_date_raw : null);

          return {
            _row: idx + 2,
            name,
            email,
            phone: (raw.phone || "").trim() || null,
            payment_type: payment_type_raw,
            purchase_date,
            is_vitalicio,
            community_expiration_date: is_vitalicio
              ? (community_raw || (isValidDate(purchase_date) ? computeCommunityExpiration(purchase_date) : null))
              : null,
            last_payment_date: payment_type_raw === "recorrente"
              ? (last_pay || (isValidDate(purchase_date) ? purchase_date : null))
              : (last_pay || null),
            tmb_status: payment_type_raw === "boleto_tmb" ? (tmb_raw || "em_dia") : (tmb_raw || null),
            notes: (raw.notes || "").trim() || null,
            is_renewal,
            manual_status,
            cancellation_date,
            cancellation_reason: cancel_reason_raw || null,
            chargeback_count,
            _errors: errors,
          };
        });
        setRows(parsed);
      },
    });
  };

  const doImport = async () => {
    if (!productId || validRows.length === 0) return;
    setImporting(true);

    // 1. Create the import log first
    const { data: importLog, error: logErr } = await supabase
      .from("imports")
      .insert({
        product_id: productId,
        expert_id: expertId || null,
        file_name: fileName,
        total_rows: rows.length,
        success_rows: 0,
        error_rows: invalidRows.length,
        status: "completed",
        imported_by: user?.email ?? null,
      })
      .select()
      .single();

    const validationErrors: ImportError[] = invalidRows.map((r) => ({
      row: r._row,
      name: r.name || "—",
      email: r.email || "—",
      reason: r._errors.join("; "),
    }));

    if (logErr || !importLog) {
      setImporting(false);
      setResult({
        inserted: 0,
        failed: validRows.length + invalidRows.length,
        errors: [
          ...validationErrors,
          { row: 0, name: "—", email: "—", reason: `Falha ao criar log de importação: ${logErr?.message ?? "desconhecido"}` },
        ],
      });
      return;
    }

    // 2. Insert enrollments tagged with import_id
    const payload = validRows.map((r) => ({
      product_id: productId,
      import_id: importLog.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      payment_type: r.payment_type,
      purchase_date: r.purchase_date,
      expiration_date: r.is_vitalicio ? null : computeExpiration(r.payment_type, r.purchase_date),
      last_payment_date: r.last_payment_date,
      tmb_status: r.tmb_status,
      notes: r.notes,
      is_vitalicio: r.is_vitalicio,
      community_expiration_date: r.community_expiration_date,
      is_renewal: r.is_renewal,
      manual_status: r.manual_status,
      cancellation_date: r.cancellation_date,
      cancellation_reason: r.cancellation_reason,
      chargeback_count: r.chargeback_count,
    }));
    const { error, count } = await supabase.from("enrollments").insert(payload, { count: "exact" });

    // 3. Update the log with final counts/status
    const inserted = error ? 0 : (count ?? validRows.length);
    const status = error ? "failed" : invalidRows.length > 0 ? "partial" : "completed";
    await supabase.from("imports").update({
      success_rows: inserted,
      status,
    }).eq("id", importLog.id);

    const insertErrors: ImportError[] = error
      ? validRows.map((r) => ({
          row: r._row,
          name: r.name,
          email: r.email,
          reason: `Erro ao inserir no banco: ${error.message}`,
        }))
      : [];

    setImporting(false);
    setResult({
      inserted,
      failed: invalidRows.length + (error ? validRows.length : 0),
      errors: [...validationErrors, ...insertErrors],
    });
    if (!error) {
      setRows([]);
      setFileName("");
      refresh();
    }
    setLogsRefresh((k) => k + 1);
  };

  const doRollback = async (log: ImportLogRow) => {
    setDeleting(true);
    await supabase.from("enrollments").delete().eq("import_id", log.id);
    await supabase.from("imports").delete().eq("id", log.id);
    setDeleting(false);
    setConfirmDelete(null);
    setLogsRefresh((k) => k + 1);
    refresh();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Importar CSV</h1>
        <p className="page-subtitle">Importação em lote de matrículas por produto.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Expert</Label>
            <Select value={expertId} onValueChange={(v) => { setExpertId(v); setProductId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{experts.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId} disabled={!expertId}>
              <SelectTrigger><SelectValue placeholder={expertId ? "Selecionar" : "Selecione um expert"} /></SelectTrigger>
              <SelectContent>{productList.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border-2 border-dashed border-border bg-secondary/40 p-6 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Colunas esperadas: <code className="text-xs">{EXPECTED_COLUMNS.join(", ")}</code>
          </p>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <label htmlFor="csv-file">
            <Button asChild className="gap-2"><span><Upload className="h-4 w-4" /> Selecionar CSV</span></Button>
          </label>
          {fileName && <p className="text-xs text-muted-foreground mt-3">{fileName} · {rows.length} linhas</p>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total linhas" value={rows.length} />
              <Stat label="Válidas" value={validRows.length} tone="ok" />
              <Stat label="Com erros" value={invalidRows.length} tone={invalidRows.length > 0 ? "bad" : undefined} />
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2"></th>
                      <th className="text-left px-3 py-2">Linha</th>
                      <th className="text-left px-3 py-2">Nome</th>
                      <th className="text-left px-3 py-2">E-mail</th>
                      <th className="text-left px-3 py-2">Pagamento</th>
                      <th className="text-left px-3 py-2">Compra</th>
                      <th className="text-left px-3 py-2">Vitalício</th>
                      <th className="text-left px-3 py-2">Erros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r._errors.length > 0 ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-2">
                          {r._errors.length === 0
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            : <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r._row}</td>
                        <td className="px-3 py-2">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                        <td className="px-3 py-2">{r.payment_type}</td>
                        <td className="px-3 py-2 tabular-nums">{r.purchase_date}</td>
                        <td className="px-3 py-2">{r.is_vitalicio ? "sim" : "não"}</td>
                        <td className="px-3 py-2 text-red-600">{r._errors.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 200 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border">
                  Mostrando 200 de {rows.length} linhas.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setRows([]); setFileName(""); }}>Limpar</Button>
              <Button
                onClick={doImport}
                disabled={importing || !productId || validRows.length === 0}
                className="btn-premium gap-2"
              >
                <Upload className="h-4 w-4" /> {importing ? "Importando…" : `Importar ${validRows.length} matrícula(s)`}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div
              className={`rounded-lg border p-4 text-sm flex items-center gap-2 ${
                result.failed === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : result.inserted === 0
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {result.failed === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              Importação concluída: {result.inserted} inseridas
              {result.failed > 0 ? `, ${result.failed} ignoradas por erros` : ""}.
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <div className="px-3 py-2 bg-red-50 text-red-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Detalhes dos {result.errors.length} erro(s)
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-3 py-2">Linha</th>
                        <th className="text-left px-3 py-2">Nome</th>
                        <th className="text-left px-3 py-2">E-mail</th>
                        <th className="text-left px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {e.row || "—"}
                          </td>
                          <td className="px-3 py-2">{e.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.email}</td>
                          <td className="px-3 py-2 text-red-600">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import history */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Histórico de importações</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmWipe(true)}
            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Limpar dados
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Arquivo</th>
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-left px-3 py-2">Expert</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Sucesso</th>
                    <th className="text-right px-3 py-2">Erros</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const edited = !!editedMap[l.id];
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                          {new Date(l.imported_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2 font-medium">{l.file_name}</td>
                        <td className="px-3 py-2">{l.product_id ? productMap.get(l.product_id) ?? "—" : "—"}</td>
                        <td className="px-3 py-2">{l.expert_id ? expertMap.get(l.expert_id) ?? "—" : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.total_rows}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{l.success_rows}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600">{l.error_rows}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <UndoButton
                            disabled={edited}
                            onClick={() => setConfirmDelete(l)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer importação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover os {confirmDelete?.success_rows ?? 0} alunos desta importação?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirmDelete) doRollback(confirmDelete); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" /> Limpar todos os dados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Isso irá remover TODAS as matrículas cadastradas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wiping}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); doWipe(); }}
              disabled={wiping}
              className="bg-red-600 hover:bg-red-700"
            >
              {wiping ? "Removendo…" : "Sim, limpar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UndoButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="ghost" size="sm" disabled className="gap-1 text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Contém edições manuais — desfazer parcialmente não é suportado</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
      <Trash2 className="h-3.5 w-3.5" /> Desfazer
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    partial: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };
  const label: Record<string, string> = {
    completed: "Concluído",
    partial: "Parcial",
    failed: "Falhou",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${map[status] ?? "bg-muted"}`}>
      {label[status] ?? status}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const cls = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
