import { StatsCard } from "@/components/ui/stats-card";
import { BookOpen, CreditCard, TrendingUp, Shield, Calculator, Clock } from "lucide-react";

interface DashboardStatsProps {
  entries: any[];
  payments: any[];
}

export function DashboardStats({ entries, payments }: DashboardStatsProps) {
  // Calculate totals
  const totalEntries = entries.length;
  const totalPayments = payments.length;
  
  // Calculate amount totals
  const totalEntriesAmount = entries.reduce((sum, entry) => {
    const amount = parseFloat(entry.montant) || 0;
    return sum + amount;
  }, 0);
  
  const totalPaymentsAmount = payments.reduce((sum, payment) => {
    const amount = parseFloat(payment.montant) || 0;
    return sum + amount;
  }, 0);
  
  // Recent activity (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const recentEntries = entries.filter(entry => 
    new Date(entry.timestamp) > weekAgo
  ).length;
  
  const recentPayments = payments.filter(payment => 
    new Date(payment.timestamp) > weekAgo
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <StatsCard
        title="Écritures comptables"
        value={totalEntries}
        description={`${totalEntriesAmount.toFixed(2)} HBAR total`}
        icon={BookOpen}
        trend={recentEntries > 0 ? {
          value: recentEntries,
          label: "cette semaine"
        } : undefined}
        variant="default"
      />
      
      <StatsCard
        title="Transactions"
        value={totalPayments}
        description={`${totalPaymentsAmount.toFixed(2)} HBAR traités`}
        icon={CreditCard}
        trend={recentPayments > 0 ? {
          value: recentPayments,
          label: "cette semaine"
        } : undefined}
        variant="success"
      />
      
      <StatsCard
        title="Volume total"
        value={`${(totalEntriesAmount + totalPaymentsAmount).toFixed(2)}`}
        description="HBAR enregistrés"
        icon={TrendingUp}
        variant="warning"
      />
      
      <StatsCard
        title="Sécurité blockchain"
        value="100%"
        description="Toutes les opérations on-chain"
        icon={Shield}
        variant="success"
      />
      
      <StatsCard
        title="Conformité"
        value="Actif"
        description="Audit trail complet"
        icon={Calculator}
        variant="default"
      />
      
      <StatsCard
        title="Activité récente"
        value={recentEntries + recentPayments}
        description="Opérations cette semaine"
        icon={Clock}
        variant={recentEntries + recentPayments > 0 ? "success" : "default"}
      />
    </div>
  );
}