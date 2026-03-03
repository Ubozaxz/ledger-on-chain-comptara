import { StatsCard } from "@/components/ui/stats-card";
import { BookOpen, CreditCard, TrendingUp, Shield, Calculator, Clock } from "lucide-react";

interface DashboardStatsProps {
  entries: any[];
  payments: any[];
}

export function DashboardStats({ entries, payments }: DashboardStatsProps) {
  const totalEntries = entries.length;
  const totalPayments = payments.length;
  
  const totalEntriesAmount = entries.reduce((sum, entry) => sum + (parseFloat(entry.montant) || 0), 0);
  const totalPaymentsAmount = payments.reduce((sum, payment) => sum + (parseFloat(payment.montant) || 0), 0);
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentEntries = entries.filter(entry => new Date(entry.created_at || entry.timestamp) > weekAgo).length;
  const recentPayments = payments.filter(payment => new Date(payment.created_at || payment.timestamp) > weekAgo).length;

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
      <StatsCard
        title="Écritures"
        value={totalEntries}
        description={`${formatAmount(totalEntriesAmount)} FCFA`}
        icon={BookOpen}
        trend={recentEntries > 0 ? { value: recentEntries, label: "cette semaine" } : undefined}
        variant="default"
      />
      <StatsCard
        title="Transactions"
        value={totalPayments}
        description={`${formatAmount(totalPaymentsAmount)} FCFA`}
        icon={CreditCard}
        trend={recentPayments > 0 ? { value: recentPayments, label: "cette semaine" } : undefined}
        variant="success"
      />
      <StatsCard
        title="Volume total"
        value={formatAmount(totalEntriesAmount + totalPaymentsAmount)}
        description="FCFA enregistrés"
        icon={TrendingUp}
        variant="warning"
      />
      <StatsCard
        title="Blockchain"
        value="100%"
        description="Opérations on-chain"
        icon={Shield}
        variant="success"
      />
      <StatsCard
        title="Conformité"
        value="Actif"
        description="Audit trail"
        icon={Calculator}
        variant="default"
      />
      <StatsCard
        title="Activité"
        value={recentEntries + recentPayments}
        description="Cette semaine"
        icon={Clock}
        variant={recentEntries + recentPayments > 0 ? "success" : "default"}
      />
    </div>
  );
}
