import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { EmptyState } from "@/components/EmptyState";
import { TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/churn")({
  component: () => <AuthGate><ChurnPage /></AuthGate>,
});

function ChurnPage() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="page-title">Churn</h1>
        <p className="page-subtitle">Gestão de pedidos de cancelamento e reversão.</p>
      </div>
      <EmptyState
        icon={<TrendingDown className="h-7 w-7" />}
        title="Módulo de churn em construção"
        description="Em breve você terá KPIs, filtros avançados e painel lateral para registrar e tratar cada solicitação de churn."
        action={<Button className="btn-premium px-5 h-10" disabled>Disponível em breve</Button>}
      />
    </div>
  );
}
