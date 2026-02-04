import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, 
  Loader2, RefreshCw, CheckCircle, XCircle, Info,
  BarChart3, PieChart, Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface AuditModuleProps {
  entries: any[];
  payments: any[];
}

interface AuditMetric {
  label: string;
  value: string | number;
  status: "good" | "warning" | "critical" | "info";
  icon: any;
}

export const AuditModule = ({ entries, payments }: AuditModuleProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<AuditMetric[]>([]);
  const { toast } = useToast();

  const calculateMetrics = (): AuditMetric[] => {
    const totalEntries = entries.length;
    const totalPayments = payments.length;
    const entriesAmount = entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const paymentsAmount = payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
    
    // Calcul des débits et crédits
    const debits = entries.filter(e => e.debit && e.debit !== "").reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const credits = entries.filter(e => e.credit && e.credit !== "").reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    
    // Écritures avec hash de transaction (validées on-chain)
    const verifiedEntries = entries.filter(e => e.tx_hash && e.tx_hash.length > 10).length;
    const verifiedPayments = payments.filter(p => p.tx_hash && p.tx_hash.length > 10).length;
    const verificationRate = totalEntries + totalPayments > 0 
      ? ((verifiedEntries + verifiedPayments) / (totalEntries + totalPayments)) * 100 
      : 0;

    // Balance débit/crédit
    const balance = debits - credits;
    const isBalanced = Math.abs(balance) < 0.01;

    // Catégorisation
    const categorizedEntries = entries.filter(e => e.category && e.category !== "").length;
    const categorizationRate = totalEntries > 0 ? (categorizedEntries / totalEntries) * 100 : 100;

    return [
      {
        label: "Transactions vérifiées",
        value: `${verificationRate.toFixed(0)}%`,
        status: verificationRate >= 80 ? "good" : verificationRate >= 50 ? "warning" : "critical",
        icon: verificationRate >= 80 ? CheckCircle : verificationRate >= 50 ? AlertTriangle : XCircle
      },
      {
        label: "Balance Débit/Crédit",
        value: isBalanced ? "Équilibré" : `${balance > 0 ? "+" : ""}${balance.toFixed(2)}`,
        status: isBalanced ? "good" : Math.abs(balance) < entriesAmount * 0.1 ? "warning" : "critical",
        icon: isBalanced ? CheckCircle : AlertTriangle
      },
      {
        label: "Volume total",
        value: `${(entriesAmount + paymentsAmount).toLocaleString()} HBAR`,
        status: "info",
        icon: BarChart3
      },
      {
        label: "Catégorisation",
        value: `${categorizationRate.toFixed(0)}%`,
        status: categorizationRate >= 80 ? "good" : categorizationRate >= 50 ? "warning" : "critical",
        icon: categorizationRate >= 80 ? CheckCircle : Target
      }
    ];
  };

  const analyzeLedger = async () => {
    if (entries.length === 0 && payments.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Ajoutez des écritures comptables ou paiements avant de lancer l'audit.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAuditResult(null);
    setHealthScore(null);

    // Calculer les métriques immédiatement
    setMetrics(calculateMetrics());

    try {
      const ledgerData = {
        entries: entries.map(e => ({
          id: e.id,
          date: e.date,
          debit: e.debit,
          credit: e.credit,
          montant: e.montant,
          description: e.description || e.libelle,
          txHash: e.tx_hash,
          category: e.category,
        })),
        payments: payments.map(p => ({
          id: p.id,
          date: p.created_at,
          type: p.type,
          montant: p.montant,
          devise: p.devise,
          destinataire: p.destinataire,
          objet: p.objet,
          txHash: p.tx_hash,
          status: p.status,
        })),
        summary: {
          totalEntries: entries.length,
          totalPayments: payments.length,
          totalDebits: entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0),
          totalPaymentAmount: payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0),
        },
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "audit",
          ledgerData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Limite de requêtes atteinte. Réessayez plus tard.");
        }
        if (response.status === 402) {
          throw new Error("Crédits IA insuffisants.");
        }
        throw new Error(errorData.error || "Échec de l'audit");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  setAuditResult(fullResponse);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      const score = calculateHealthScore(fullResponse, entries, payments);
      setHealthScore(score);
      localStorage.setItem("lastAuditDate", new Date().toISOString());

      toast({
        title: "Audit terminé",
        description: `Score de santé financière: ${score}%`,
      });
    } catch (error: any) {
      console.error("Audit error:", error);
      toast({
        title: "Erreur d'audit",
        description: error.message || "Impossible de lancer l'audit",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateHealthScore = (analysis: string, entries: any[], payments: any[]): number => {
    let score = 100;
    const lowerAnalysis = analysis.toLowerCase();
    
    // Pénalités pour problèmes détectés
    const criticalKeywords = ['anomalie majeure', 'erreur critique', 'fraude', 'double saisie'];
    const warningKeywords = ['incohérence', 'attention', 'risque', 'vérifier'];
    const positiveKeywords = ['correct', 'cohérent', 'équilibré', 'excellent', 'conforme'];

    criticalKeywords.forEach(keyword => {
      if (lowerAnalysis.includes(keyword)) score -= 15;
    });
    
    warningKeywords.forEach(keyword => {
      if (lowerAnalysis.includes(keyword)) score -= 5;
    });

    positiveKeywords.forEach(keyword => {
      if (lowerAnalysis.includes(keyword)) score += 3;
    });

    // Bonus pour volume de données
    if (entries.length >= 10) score += 5;
    if (payments.length >= 5) score += 3;
    
    // Pénalité si peu de données
    if (entries.length < 3) score -= 10;

    // Vérification on-chain
    const verified = entries.filter(e => e.tx_hash).length + payments.filter(p => p.tx_hash).length;
    const total = entries.length + payments.length;
    if (total > 0 && verified / total < 0.5) score -= 10;

    return Math.max(0, Math.min(100, score));
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { text: "Excellent", variant: "default" as const, bg: "bg-success/10 text-success border-success/20" };
    if (score >= 60) return { text: "Attention", variant: "secondary" as const, bg: "bg-warning/10 text-warning border-warning/20" };
    return { text: "Critique", variant: "destructive" as const, bg: "bg-destructive/10 text-destructive border-destructive/20" };
  };

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case "good": return "text-success";
      case "warning": return "text-warning";
      case "critical": return "text-destructive";
      default: return "text-primary";
    }
  };

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Audit IA Avancé</span>
          </div>
          <Button
            onClick={analyzeLedger}
            disabled={isAnalyzing}
            size="sm"
            className="bg-gradient-primary hover:opacity-90"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyse...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Lancer l'audit
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métriques rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(metrics.length > 0 ? metrics : calculateMetrics()).map((metric, idx) => (
            <div key={idx} className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
              <metric.icon className={`h-5 w-5 mx-auto ${getMetricStatusColor(metric.status)}`} />
              <p className="text-lg font-bold text-foreground">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Score de santé */}
        {healthScore !== null && (
          <div className="bg-card border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {healthScore >= 60 ? (
                  <TrendingUp className={`h-5 w-5 ${getHealthColor(healthScore)}`} />
                ) : (
                  <TrendingDown className={`h-5 w-5 ${getHealthColor(healthScore)}`} />
                )}
                <span className="font-medium">Score de Santé Financière</span>
              </div>
              <Badge className={getHealthBadge(healthScore).bg}>
                {getHealthBadge(healthScore).text}
              </Badge>
            </div>
            <Progress value={healthScore} className="h-3" />
            <p className={`text-center text-3xl font-bold ${getHealthColor(healthScore)}`}>
              {healthScore}%
            </p>
          </div>
        )}

        {/* Résultats d'audit */}
        {auditResult && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Rapport d'Audit Détaillé</span>
            </div>
            <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{auditResult}</ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        )}

        {!auditResult && !isAnalyzing && (
          <div className="text-center py-6 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Prêt pour l'audit</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              L'IA analysera vos {entries.length} écritures et {payments.length} paiements pour détecter anomalies et optimisations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
