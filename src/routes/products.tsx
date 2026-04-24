import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { EmptyState } from "@/components/EmptyState";
import { useMbcData } from "@/lib/data";
import { useExpertFilter, expertPalette } from "@/lib/expert-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Archive, ArchiveRestore, Package, UserPlus, Sparkles, Sprout, X } from "lucide-react";

async function runSeed() {
  const { data: existing } = await supabase.from("experts").select("name");
  const names = new Set((existing ?? []).map((e: { name: string }) => e.name));
  const toInsert = [{ name: "Charles França" }, { name: "Jorge Penna" }].filter((e) => !names.has(e.name));
  if (toInsert.length) await supabase.from("experts").insert(toInsert);
  const { data: allExperts } = await supabase.from("experts").select("id, name");
  const byName = new Map((allExperts ?? []).map((e: { id: string; name: string }) => [e.name, e.id]));
  const seedProducts = [
    { name: "ACP 360°", expert: "Charles França" },
    { name: "Formação Calculista Pro", expert: "Jorge Penna" },
    { name: "Pós-Graduação", expert: "Jorge Penna" },
  ];
  const { data: existingProducts } = await supabase.from("products").select("name, expert_id");
  const productKey = new Set((existingProducts ?? []).map((p: { name: string; expert_id: string }) => `${p.expert_id}::${p.name}`));
  const productsToInsert = seedProducts
    .map((p) => ({ name: p.name, expert_id: byName.get(p.expert) as string | undefined }))
    .filter((p): p is { name: string; expert_id: string } => Boolean(p.expert_id) && !productKey.has(`${p.expert_id}::${p.name}`));
  if (productsToInsert.length) await supabase.from("products").insert(productsToInsert);
}

export const Route = createFileRoute("/products")({
  component: () => <AuthGate><ProductsMgmt /></AuthGate>,
});

function ProductsMgmt() {
  const { experts, products, refresh, loading } = useMbcData();
  const { expertId, setExpertId } = useExpertFilter();
  const [newExpert, setNewExpert] = useState("");
  const [showNewExpert, setShowNewExpert] = useState(false);
  const [newProduct, setNewProduct] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const visibleExperts = expertId ? experts.filter((e) => e.id === expertId) : experts;

  const addExpert = async () => {
    if (!newExpert.trim()) return;
    await supabase.from("experts").insert({ name: newExpert.trim() });
    setNewExpert("");
    setShowNewExpert(false);
    refresh();
  };
  const addProduct = async (expId: string) => {
    const name = newProduct[expId]?.trim();
    if (!name) return;
    await supabase.from("products").insert({ expert_id: expId, name });
    setNewProduct({ ...newProduct, [expId]: "" });
    setAddingFor(null);
    refresh();
  };
  const toggleArchiveExpert = async (id: string, archived: boolean) => {
    await supabase.from("experts").update({ archived: !archived }).eq("id", id);
    refresh();
  };
  const toggleArchiveProduct = async (id: string, archived: boolean) => {
    await supabase.from("products").update({ archived: !archived }).eq("id", id);
    refresh();
  };
  const saveInternalId = async (id: string, value: string) => {
    const ids = value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await supabase.from("products").update({ internal_id: ids.length === 0 ? null : ids }).eq("id", id);
    refresh();
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="page-subtitle">Cada expert é um workspace. Gerencie produtos digitais sob a MBC.</p>
        </div>
        <div className="flex gap-2">
          {expertId && (
            <Button
              variant="ghost"
              className="gap-2 h-10 px-3 text-muted-foreground hover:text-foreground"
              onClick={() => setExpertId(null)}
            >
              <X className="h-4 w-4" /> Limpar filtro
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2 h-10 px-4 border-dashed text-muted-foreground hover:text-foreground"
            onClick={async () => { await runSeed(); refresh(); }}
          >
            <Sprout className="h-4 w-4" /> Run seed
          </Button>
          <Button onClick={() => setShowNewExpert((v) => !v)} className="btn-premium gap-2 h-10 px-5">
            <UserPlus className="h-4 w-4" /> Novo expert
          </Button>
        </div>
      </div>

      {showNewExpert && (
        <div className="surface-card p-4 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            autoFocus
            placeholder="Nome do expert"
            value={newExpert}
            onChange={(e) => setNewExpert(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExpert()}
          />
          <Button onClick={addExpert} className="btn-premium gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
          <Button variant="ghost" onClick={() => { setShowNewExpert(false); setNewExpert(""); }}>Cancelar</Button>
        </div>
      )}

      {loading && <div className="text-muted-foreground">Carregando…</div>}

      {!loading && experts.length === 0 && (
        <EmptyState
          icon={<Sparkles className="h-7 w-7" />}
          title="Nenhum expert cadastrado"
          description="Comece adicionando o primeiro expert da agência. Você poderá então cadastrar os produtos digitais dele."
          action={
            <Button onClick={() => setShowNewExpert(true)} className="btn-premium gap-2 h-10 px-5">
              <UserPlus className="h-4 w-4" /> Adicionar primeiro expert
            </Button>
          }
        />
      )}

      <div className="space-y-8">
        {visibleExperts.map((ex) => {
          const list = products.filter((p) => p.expert_id === ex.id);
          const activeCount = list.filter((p) => !p.archived).length;
          const isAdding = addingFor === ex.id;
          const palette = expertPalette(ex.name);
          return (
            <section
              key={ex.id}
              className={`rounded-2xl overflow-hidden border border-border bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)] ${ex.archived ? "opacity-60" : ""}`}
            >
              {/* Banner */}
              <div className="relative px-6 md:px-8 pt-6 pb-5" style={{ background: palette.gradient }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0 bg-white/85 backdrop-blur"
                      style={{ color: palette.accent }}
                    >
                      {ex.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold text-[#111827] tracking-tight truncate">{ex.name}</h2>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${palette.chip}`}
                        >
                          {activeCount} {activeCount === 1 ? "produto" : "produtos"}
                        </span>
                      </div>
                      <div className="text-sm text-[#111827]/65 mt-1">Workspace do expert</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 bg-white/70 hover:bg-white text-[#111827]"
                      onClick={() => setAddingFor(isAdding ? null : ex.id)}
                    >
                      <Plus className="h-4 w-4" /> Produto
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 bg-white/70 hover:bg-white text-[#111827]"
                      onClick={() => toggleArchiveExpert(ex.id, ex.archived)}
                    >
                      {ex.archived ? <><ArchiveRestore className="h-4 w-4" /> Restaurar</> : <><Archive className="h-4 w-4" /> Arquivar</>}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="p-5 md:p-6 space-y-3">
                {isAdding && (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Nome do produto"
                      value={newProduct[ex.id] ?? ""}
                      onChange={(e) => setNewProduct({ ...newProduct, [ex.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addProduct(ex.id)}
                    />
                    <Button onClick={() => addProduct(ex.id)} className="btn-premium gap-2">
                      <Plus className="h-4 w-4" /> Salvar
                    </Button>
                    <Button variant="ghost" onClick={() => setAddingFor(null)}>Cancelar</Button>
                  </div>
                )}

                {list.length === 0 && !isAdding && (
                  <div className="rounded-lg px-4 py-8 text-center text-sm text-muted-foreground border border-dashed border-border bg-[#FAFAFB]">
                    Nenhum produto ainda. Clique em <strong>Produto</strong> para adicionar.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className={`group flex flex-col gap-2 rounded-lg p-3 border border-border bg-white hover:border-foreground/30 hover:shadow-md transition-all ${p.archived ? "opacity-60" : ""}`}
                    >
                      <Link
                        to="/products/$productId"
                        params={{ productId: p.id }}
                        className="flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: `${palette.accent}15`, color: palette.accent }}
                          >
                            <Package className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium truncate">{p.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 transition-opacity"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleArchiveProduct(p.id, p.archived); }}
                          title={p.archived ? "Restaurar" : "Arquivar"}
                        >
                          {p.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                      </Link>
                      <InternalIdField
                        productId={p.id}
                        initial={Array.isArray(p.internal_id) ? p.internal_id.join(", ") : ""}
                        onSave={saveInternalId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function InternalIdField({
  productId,
  initial,
  onSave,
}: {
  productId: string;
  initial: string;
  onSave: (id: string, value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;
  const commit = async () => {
    if (!dirty) return;
    setSaving(true);
    try { await onSave(productId, value); } finally { setSaving(false); }
  };
  return (
    <div className="flex items-center gap-1.5 pt-1 border-t border-dashed border-border">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Guru IDs</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="id1, id2, id3"
        className="h-7 text-xs px-2"
        disabled={saving}
      />
    </div>
  );
}
