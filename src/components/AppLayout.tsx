import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Package, Upload, TrendingDown, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useMbcData } from "@/lib/data";
import { expertPalette } from "@/lib/expert-filter";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Alunos", icon: Users },
  { to: "/products", label: "Produtos", icon: Package },
  { to: "/churn", label: "Churn", icon: TrendingDown },
  { to: "/import", label: "Importar CSV", icon: Upload },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { experts, refresh } = useMbcData();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const activeExperts = experts.filter((e) => !e.archived);

  const createExpert = async () => {
    const name = draft.trim();
    if (!name) { setAdding(false); return; }
    await supabase.from("experts").insert({ name });
    setDraft("");
    setAdding(false);
    refresh();
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-[#14151A] text-sm"
              style={{ background: "var(--gradient-gold)" }}
            >
              M
            </div>
            <div>
              <div className="text-base font-semibold leading-none tracking-tight text-white">
                MBC <span style={{ color: "#C9BE95" }}>Hub</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mt-1.5">
                Internal CRM
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-3 pb-2 pt-1 text-[10px] uppercase tracking-[0.16em] text-white/35 font-semibold">
            Workspace global
          </div>
          {NAV.map((n) => {
            const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "text-white font-medium"
                    : "text-white/65 hover:text-white hover:bg-white/[0.05]"
                }`}
                style={active ? { background: "#1F2937" } : undefined}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                    style={{ background: "#C9BE95" }}
                  />
                )}
                <Icon className="h-4 w-4" style={active ? { color: "#C9BE95" } : undefined} />
                {n.label}
              </Link>
            );
          })}

          <div className="px-3 pb-2 pt-5 text-[10px] uppercase tracking-[0.16em] text-white/35 font-semibold">
            Experts
          </div>

          {activeExperts.map((ex) => {
            const palette = expertPalette(ex.name);
            const active = loc.pathname.startsWith(`/experts/${ex.id}`);
            return (
              <Link
                key={ex.id}
                to="/experts/$expertId"
                params={{ expertId: ex.id }}
                className={`group relative flex items-center gap-3 pl-4 pr-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "text-white font-medium"
                    : "text-white/65 hover:text-white hover:bg-white/[0.04]"
                }`}
                style={active ? { background: "#1F2937" } : undefined}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                    style={{ background: palette.accent }}
                  />
                )}
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: palette.dot }}
                />
                <span className="truncate">{ex.name}</span>
              </Link>
            );
          })}

          {adding ? (
            <div className="px-3 pt-2 flex items-center gap-1.5">
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createExpert();
                  if (e.key === "Escape") { setAdding(false); setDraft(""); }
                }}
                placeholder="Nome do expert"
                className="h-8 bg-white/[0.06] border-white/10 text-white placeholder:text-white/35 text-sm"
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full mt-1 flex items-center gap-2 pl-4 pr-3 py-2 rounded-md text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Novo expert
            </button>
          )}
        </nav>

        {user && (
          <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-xs text-white/55 px-3 pb-2 truncate">{user.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/[0.06]"
              onClick={async () => {
                await signOut();
                nav({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        )}
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
