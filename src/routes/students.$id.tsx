import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { computeExpiration, computeCommunityExpiration, computeStatus, statusColor, PAYMENT_LABELS, STATUS_LABELS, TMB_LABELS, type EnrollmentLike } from "@/lib/status";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/students/$id")({
  component: () => <AuthGate><StudentProfile /></AuthGate>,
});

interface FullEnrollment extends EnrollmentLike {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  product_id: string;
  notes: string | null;
  is_vitalicio: boolean;
  community_expiration_date: string | null;
}
interface HistoryItem { id: string; note: string; created_at: string }

function StudentProfile() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [data, setData] = useState<FullEnrollment | null>(null);
  const [productName, setProductName] = useState("");
  const [expertName, setExpertName] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: en } = await supabase.from("enrollments").select("*").eq("id", id).maybeSingle();
    if (en) {
      setData(en as FullEnrollment);
      const { data: prod } = await supabase.from("products").select("name, expert_id").eq("id", en.product_id).maybeSingle();
      if (prod) {
        setProductName(prod.name);
        const { data: exp } = await supabase.from("experts").select("name").eq("id", prod.expert_id).maybeSingle();
        setExpertName(exp?.name ?? "");
      }
    }
    const { data: h } = await supabase.from("enrollment_history").select("*").eq("enrollment_id", id).order("created_at", { ascending: false });
    setHistory((h ?? []) as HistoryItem[]);
  };

  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const status = computeStatus(data);

  const update = (patch: Partial<FullEnrollment>) => setData({ ...data, ...patch });

  const save = async () => {
    setSaving(true);
    const exp = data.is_vitalicio
      ? null
      : (data.expiration_date || computeExpiration(data.payment_type, data.purchase_date));
    const community = data.is_vitalicio
      ? (data.community_expiration_date || computeCommunityExpiration(data.purchase_date))
      : null;
    const { error } = await supabase.from("enrollments").update({
      name: data.name, email: data.email, phone: data.phone,
      payment_type: data.payment_type, purchase_date: data.purchase_date,
      expiration_date: exp, last_payment_date: data.last_payment_date,
      tmb_status: data.tmb_status, manual_status: data.manual_status, notes: data.notes,
      is_vitalicio: data.is_vitalicio,
      community_expiration_date: community,
    }).eq("id", id);
    setSaving(false);
    if (!error) load();
  };

  const remove = async () => {
    if (!confirm("Remover esta matrícula?")) return;
    await supabase.from("enrollments").delete().eq("id", id);
    nav({ to: "/students" });
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await supabase.from("enrollment_history").insert({ enrollment_id: id, note: newNote.trim() });
    setNewNote("");
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{expertName} · {productName}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.is_vitalicio && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <Sparkles className="h-3 w-3" /> Vitalício
            </span>
          )}
          <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs ${statusColor(status)}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados da matrícula</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome"><Input value={data.name} onChange={(e) => update({ name: e.target.value })} /></Field>
          <Field label="E-mail"><Input value={data.email} onChange={(e) => update({ email: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={data.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={data.payment_type} onValueChange={(v) => update({ payment_type: v as FullEnrollment["payment_type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
                <SelectItem value="boleto_tmb">Boleto TMB</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data da compra">
            <Input type="date" value={data.purchase_date} onChange={(e) => {
              const purchase_date = e.target.value;
              update({ purchase_date, expiration_date: data.is_vitalicio ? null : computeExpiration(data.payment_type, purchase_date) });
            }} />
          </Field>
          <Field label="Vitalício">
            <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-input bg-background">
              <Switch checked={!!data.is_vitalicio} onCheckedChange={(v) => update({
                is_vitalicio: v,
                expiration_date: v ? null : computeExpiration(data.payment_type, data.purchase_date),
                community_expiration_date: v ? (data.community_expiration_date ?? computeCommunityExpiration(data.purchase_date)) : null,
              })} />
              <span className="text-sm text-muted-foreground">Sem expiração de conteúdo · comunidade vence em 2 anos</span>
            </div>
          </Field>
          {!data.is_vitalicio && (
            <Field label="Data de expiração">
              <Input type="date" value={data.expiration_date ?? ""} onChange={(e) => update({ expiration_date: e.target.value })} />
            </Field>
          )}
          {data.is_vitalicio && (
            <Field label="Vencimento da comunidade">
              <Input type="date" value={data.community_expiration_date ?? ""} onChange={(e) => update({ community_expiration_date: e.target.value || null })} />
            </Field>
          )}
          {data.payment_type === "recorrente" && (
            <Field label="Último pagamento">
              <Input type="date" value={data.last_payment_date ?? ""} onChange={(e) => update({ last_payment_date: e.target.value || null })} />
            </Field>
          )}
          {data.payment_type === "boleto_tmb" && (
            <Field label="Status TMB">
              <Select value={data.tmb_status ?? ""} onValueChange={(v) => update({ tmb_status: v as FullEnrollment["tmb_status"] })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TMB_LABELS) as Array<keyof typeof TMB_LABELS>).map((k) => (
                    <SelectItem key={k} value={k}>{TMB_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Status manual (override)">
            <Select value={data.manual_status ?? "none"} onValueChange={(v) => update({ manual_status: v === "none" ? null : v as "cancelado" | "reembolsado" | "inadimplente" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— nenhum —</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="reembolsado">Reembolsado</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações" full>
            <Textarea value={data.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} rows={3} />
          </Field>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" className="text-destructive hover:text-destructive gap-2" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico de status</h2>
        <div className="flex gap-2">
          <Input placeholder="Adicionar nota…" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
          <Button onClick={addNote}>Adicionar</Button>
        </div>
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="text-sm border-l-2 border-primary/40 pl-3 py-1">
              <div>{h.note}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
            </li>
          ))}
          {history.length === 0 && <li className="text-sm text-muted-foreground">Sem histórico.</li>}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
