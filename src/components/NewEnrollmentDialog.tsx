import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { computeExpiration, computeCommunityExpiration, type PaymentType, type TmbStatus } from "@/lib/status";
import type { ExpertRow, ProductRow } from "@/lib/data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  experts: ExpertRow[];
  products: ProductRow[];
  defaultProductId?: string;
  onCreated: () => void;
}

export function NewEnrollmentDialog({ open, onOpenChange, experts, products, defaultProductId, onCreated }: Props) {
  const [expertId, setExpertId] = useState(experts[0]?.id ?? "");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("parcelado");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [tmbStatus, setTmbStatus] = useState<TmbStatus>("em_dia");
  const [isVitalicio, setIsVitalicio] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const productList = expertId ? products.filter((p) => p.expert_id === expertId) : products;

  const submit = async () => {
    setErr(null);
    if (!productId || !name || !email) { setErr("Preencha produto, nome e e-mail."); return; }
    setSaving(true);
    const { error } = await supabase.from("enrollments").insert({
      product_id: productId,
      name, email, phone: phone || null,
      payment_type: paymentType,
      purchase_date: purchaseDate,
      expiration_date: isVitalicio ? null : computeExpiration(paymentType, purchaseDate),
      last_payment_date: paymentType === "recorrente" ? purchaseDate : null,
      tmb_status: paymentType === "boleto_tmb" ? tmbStatus : null,
      is_vitalicio: isVitalicio,
      community_expiration_date: isVitalicio ? computeCommunityExpiration(purchaseDate) : null,
      is_renewal: isRenewal,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onOpenChange(false);
    setName(""); setEmail(""); setPhone(""); setIsVitalicio(false); setIsRenewal(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova matrícula</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Expert</Label>
            <Select value={expertId} onValueChange={(v) => { setExpertId(v); setProductId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{experts.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{productList.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2"><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
                <SelectItem value="boleto_tmb">Boleto TMB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Data da compra</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
          <div className="col-span-2 flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Vitalício</Label>
              <p className="text-[11px] text-muted-foreground">Conteúdo sem expiração. Comunidade vence em 2 anos.</p>
            </div>
            <Switch checked={isVitalicio} onCheckedChange={setIsVitalicio} />
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Renovação</Label>
              <p className="text-[11px] text-muted-foreground">Marque se este aluno é uma re-compra de matrícula expirada/cancelada.</p>
            </div>
            <Switch checked={isRenewal} onCheckedChange={setIsRenewal} />
          </div>
          {paymentType === "boleto_tmb" && (
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Status TMB inicial</Label>
              <Select value={tmbStatus} onValueChange={(v) => setTmbStatus(v as TmbStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                  <SelectItem value="em_atraso">Em atraso</SelectItem>
                  <SelectItem value="negativado">Negativado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
