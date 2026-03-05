import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, 
  Loader2, RefreshCw, CheckCircle, XCircle,
  BarChart3, PieChart, Target, Lightbulb, FileText,
  Percent, Calculator, AlertCircle, Maximize2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { buildJsonHeaders } from "@/lib/auth-headers";

interface AuditModuleProps {
  entries: any[];
  payments: any[];
}

interface AuditMetric {
  label: string;
  value: string | number;
  status: "good" | "warning" | "critical" | "info";
  icon: any;
  description?: string;
}

interface Recommendation {
  type: "success" | "warning" | "critical" | "info";
  title: string;
  description: string;
  action?: string;
}

export const AuditModule = ({ entries, payments }: AuditModuleProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<AuditMetric[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const { toast } = useToast();

  const calculateMetrics = (): AuditMetric[] => {
    const totalEntries = entries.length;
    const totalPayments = payments.length;
    const entriesAmount = entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const paymentsAmount = payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
    const debits = entries.filter(e => e.debit && e.debit !== "").reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const credits = entries.filter(e => e.credit && e.credit !== "").reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const verifiedEntries = entries.filter(e => e.tx_hash && e.tx_hash.length > 10).length;
    const verifiedPayments = payments.filter(p => p.tx_hash && p.tx_hash.length > 10).length;
    const verificationRate = totalEntries + totalPayments > 0 
      ? ((verifiedEntries + verifiedPayments) / (totalEntries + totalPayments)) * 100 : 0;
    const balance = debits - credits;
    const isBalanced = Math.abs(balance) < 0.01;
    const categorizedEntries = entries.filter(e => e.category && e.category !== "").length;
    const categorizationRate = totalEntries > 0 ? (categorizedEntries / totalEntries) * 100 : 100;
    const entriesWithTVA = entries.filter(e => e.tva_rate !== null && e.tva_rate !== undefined).length;
    const tvaRate = totalEntries > 0 ? (entriesWithTVA / totalEntries) * 100 : 0;
    const totalTVA = entries.reduce((sum, e) => sum + (parseFloat(e.montant_tva) || 0), 0);

    return [
      {
        label: "On-chain",
        value: `${verificationRate.toFixed(0)}%`,
        status: verificationRate >= 80 ? "good" : verificationRate >= 50 ? "warning" : "critical",
        icon: verificationRate >= 80 ? CheckCircle : verificationRate >= 50 ? AlertTriangle : XCircle,
        description: `${verifiedEntries + verifiedPayments}/${totalEntries + totalPayments} vérifiées`
      },
      {
        label: "Balance",
        value: isBalanced ? "OK" : `${balance > 0 ? "+" : ""}${balance.toLocaleString('fr-FR', {maximumFractionDigits: 0})}`,
        status: isBalanced ? "good" : Math.abs(balance) < entriesAmount * 0.1 ? "warning" : "critical",
        icon: isBalanced ? CheckCircle : AlertTriangle,
        description: isBalanced ? "Débits = Crédits" : "Écart détecté"
      },
      {
        label: "Volume",
        value: `${((entriesAmount + paymentsAmount) / 1000).toFixed(0)}k`,
        status: "info",
        icon: BarChart3,
        description: `${totalEntries} écr., ${totalPayments} paie.`
      },
      {
        label: "Catégories",
        value: `${categorizationRate.toFixed(0)}%`,
        status: categorizationRate >= 80 ? "good" : categorizationRate >= 50 ? "warning" : "critical",
        icon: categorizationRate >= 80 ? CheckCircle : Target,
        description: `${categorizedEntries}/${totalEntries} classées`
      },
      {
        label: "TVA",
        value: `${tvaRate.toFixed(0)}%`,
        status: tvaRate >= 70 ? "good" : tvaRate >= 40 ? "warning" : "info",
        icon: Percent,
        description: `TVA: ${totalTVA.toLocaleString('fr-FR', {maximumFractionDigits: 0})} FCFA`
      },
      {
        label: "Moy. Tx",
        value: `${(totalEntries + totalPayments > 0 ? ((entriesAmount + paymentsAmount) / (totalEntries + totalPayments) / 1000) : 0).toFixed(0)}k`,
        status: "info",
        icon: Calculator,
        description: "FCFA par transaction"
      }
    ];
  };

  const generateRecommendations = (metrics: AuditMetric[]): Recommendation[] => {
    const recs: Recommendation[] = [];
    const verificationMetric = metrics.find(m => m.label === "On-chain");
    if (verificationMetric && verificationMetric.status === "critical") {
      recs.push({
        type: "warning",
        title: "Faible taux de vérification blockchain",
        description: "Moins de 50% de vos transactions sont ancrées on-chain. Activez l'ancrage blockchain.",
        action: "Activer l'ancrage"
      });
    }
    const balanceMetric = metrics.find(m => m.label === "Balance");
    if (balanceMetric && balanceMetric.status !== "good") {
      recs.push({
        type: "critical",
        title: "Déséquilibre comptable",
        description: "Vos débits et crédits ne sont pas équilibrés. Vérifiez vos écritures récentes.",
        action: "Vérifier les écritures"
      });
    }
    const tvaMetric = metrics.find(m => m.label === "TVA");
    if (tvaMetric && (tvaMetric.status === "warning" || tvaMetric.status === "info")) {
      recs.push({
        type: "info",
        title: "Suivi TVA incomplet",
        description: "Certaines écritures n'ont pas de TVA. Complétez pour vos déclarations fiscales.",
        action: "Configurer TVA"
      });
    }
    const catMetric = metrics.find(m => m.label === "Catégories");
    if (catMetric && catMetric.status !== "good") {
      recs.push({
        type: "warning",
        title: "Catégorisation incomplète",
        description: "Catégorisez vos écritures pour de meilleurs rapports.",
        action: "Catégoriser"
      });
    }
    if (entries.length >= 5 && recs.length === 0) {
      recs.push({
        type: "success",
        title: "Excellent état comptable",
        description: "Votre comptabilité est bien tenue. Continuez ainsi!",
      });
    }
    return recs;
  };

  const analyzeLedger = async () => {
    if (entries.length === 0 && payments.length === 0) {
      toast({ title: "Aucune donnée", description: "Ajoutez des écritures avant de lancer l'audit.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAuditResult(null);
    setHealthScore(null);

    const calculatedMetrics = calculateMetrics();
    setMetrics(calculatedMetrics);
    setRecommendations(generateRecommendations(calculatedMetrics));

    try {
      const ledgerData = {
        entries: entries.map(e => ({
          id: e.id, date: e.date, debit: e.debit, credit: e.credit,
          montant: e.montant, description: e.description || e.libelle,
          txHash: e.tx_hash, category: e.category,
          tvaRate: e.tva_rate, montantHT: e.montant_ht, montantTVA: e.montant_tva,
        })),
        payments: payments.map(p => ({
          id: p.id, date: p.created_at, type: p.type, montant: p.montant,
          devise: p.devise, destinataire: p.destinataire, objet: p.objet,
          txHash: p.tx_hash, status: p.status,
        })),
        summary: {
          totalEntries: entries.length,
          totalPayments: payments.length,
          totalDebits: entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0),
          totalPaymentAmount: payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0),
          totalTVA: entries.reduce((sum, e) => sum + (parseFloat(e.montant_tva) || 0), 0),
        },
      };

      const headers = await buildJsonHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST", headers,
        body: JSON.stringify({ action: "audit", ledgerData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Error("Limite de requêtes atteinte.");
        if (response.status === 402) throw new Error("Crédits IA insuffisants.");
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
              } catch (e) {}
            }
          }
        }
      }

      const score = calculateHealthScore(fullResponse, entries, payments);
      setHealthScore(score);
      localStorage.setItem("lastAuditDate", new Date().toISOString());
      toast({ title: "Audit terminé", description: `Score: ${score}%` });
    } catch (error: any) {
      console.error("Audit error:", error);
      toast({ title: "Erreur d'audit", description: error.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateHealthScore = (analysis: string, entries: any[], payments: any[]): number => {
    let score = 100;
    const lower = analysis.toLowerCase();
    ['anomalie majeure', 'erreur critique', 'fraude', 'double saisie', 'incohérence grave'].forEach(k => { if (lower.includes(k)) score -= 15; });
    ['incohérence', 'attention', 'risque', 'vérifier', 'manquant'].forEach(k => { if (lower.includes(k)) score -= 5; });
    ['correct', 'cohérent', 'équilibré', 'excellent', 'conforme'].forEach(k => { if (lower.includes(k)) score += 3; });
    if (entries.length >= 10) score += 5;
    if (entries.length < 3) score -= 10;
    const verified = entries.filter(e => e.tx_hash).length + payments.filter(p => p.tx_hash).length;
    const total = entries.length + payments.length;
    if (total > 0 && verified / total < 0.5) score -= 10;
    return Math.max(0, Math.min(100, score));
  };

  const getHealthColor = (score: number) => score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
  const getHealthBadge = (score: number) => {
    if (score >= 80) return { text: "Excellent", bg: "bg-success/10 text-success border-success/20" };
    if (score >= 60) return { text: "Attention", bg: "bg-warning/10 text-warning border-warning/20" };
    return { text: "Critique", bg: "bg-destructive/10 text-destructive border-destructive/20" };
  };
  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case "good": return "text-success bg-success/10";
      case "warning": return "text-warning bg-warning/10";
      case "critical": return "text-destructive bg-destructive/10";
      default: return "text-primary bg-primary/10";
    }
  };
  const getRecIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />;
      case "critical": return <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
      default: return <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />;
    }
  };

  const displayedMetrics = metrics.length > 0 ? metrics : calculateMetrics();
  const displayedRecs = recommendations.length > 0 ? recommendations : generateRecommendations(displayedMetrics);

  return (
    <Card className="card-modern">
      <CardHeader className="pb-2 p-3 sm:p-6">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm sm:text-base">Audit IA</span>
          </div>
          <Button onClick={analyzeLedger} disabled={isAnalyzing} size="sm"
            className="bg-gradient-primary hover:opacity-90 h-8 text-xs touch-manipulation">
            {isAnalyzing ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Analyse...</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Lancer</>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-6 pt-0">
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-3 h-8">
            <TabsTrigger value="metrics" className="text-[10px] sm:text-xs h-7">
              <PieChart className="h-3 w-3 mr-1" />Métriques
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-[10px] sm:text-xs h-7">
              <Lightbulb className="h-3 w-3 mr-1" />Conseils
            </TabsTrigger>
            <TabsTrigger value="report" className="text-[10px] sm:text-xs h-7">
              <FileText className="h-3 w-3 mr-1" />Rapport
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {displayedMetrics.map((metric, idx) => (
                <div key={idx} className={`rounded-lg p-2 sm:p-3 text-center space-y-0.5 ${getMetricStatusColor(metric.status)}`}>
                  <metric.icon className="h-4 w-4 mx-auto" />
                  <p className="text-sm sm:text-lg font-bold leading-tight">{metric.value}</p>
                  <p className="text-[9px] sm:text-xs opacity-80 leading-tight">{metric.label}</p>
                  {metric.description && (
                    <p className="text-[8px] sm:text-[10px] opacity-60 leading-tight hidden sm:block">{metric.description}</p>
                  )}
                </div>
              ))}
            </div>

            {healthScore !== null && (
              <div className="bg-card border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {healthScore >= 60 ? (
                      <TrendingUp className={`h-4 w-4 ${getHealthColor(healthScore)}`} />
                    ) : (
                      <TrendingDown className={`h-4 w-4 ${getHealthColor(healthScore)}`} />
                    )}
                    <span className="font-medium text-xs sm:text-sm">Santé Financière</span>
                  </div>
                  <Badge className={getHealthBadge(healthScore).bg + " text-[10px]"}>
                    {getHealthBadge(healthScore).text}
                  </Badge>
                </div>
                <Progress value={healthScore} className="h-2" />
                <p className={`text-center text-2xl font-bold ${getHealthColor(healthScore)}`}>
                  {healthScore}%
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-2">
            <ScrollArea className="h-[300px] sm:h-[400px]">
              <div className="space-y-2 pr-2">
                {displayedRecs.map((rec, idx) => (
                  <div key={idx} className={`rounded-lg p-2.5 sm:p-3 border ${
                    rec.type === 'success' ? 'bg-success/5 border-success/20' :
                    rec.type === 'warning' ? 'bg-warning/5 border-warning/20' :
                    rec.type === 'critical' ? 'bg-destructive/5 border-destructive/20' :
                    'bg-primary/5 border-primary/20'
                  }`}>
                    <div className="flex items-start space-x-2.5">
                      {getRecIcon(rec.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm">{rec.title}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 break-words">{rec.description}</p>
                        {rec.action && (
                          <Button variant="link" size="sm" className="h-5 p-0 mt-1 text-[10px] sm:text-xs">
                            {rec.action} →
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {displayedRecs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Lancez un audit pour obtenir des conseils</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="report" className="space-y-2">
            {/* Inline preview */}
            <ScrollArea className="h-[250px] sm:h-[350px] rounded-lg border bg-muted/20 p-3">
              {auditResult ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed
                  prose-headings:text-foreground prose-h2:text-base prose-h3:text-sm prose-h2:mt-4 prose-h3:mt-3
                  prose-table:text-xs prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1
                  prose-ul:my-1 prose-li:my-0.5 prose-p:my-1.5">
                  <ReactMarkdown>{auditResult}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-sm">Prêt pour l'audit</p>
                  <p className="text-xs mt-1">
                    L'IA analysera {entries.length} écritures et {payments.length} paiements.
                  </p>
                </div>
              )}
            </ScrollArea>
            
            {/* Full-screen dialog for reading - FIXED for mobile */}
            {auditResult && (
              <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full h-9 text-xs touch-manipulation">
                    <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                    Lire le rapport complet
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
                  <DialogHeader className="p-3 sm:p-4 pb-2 border-b flex-shrink-0">
                    <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      <span>Rapport d'Audit</span>
                      {healthScore !== null && (
                        <Badge className={getHealthBadge(healthScore).bg + " text-xs ml-2"}>
                          {healthScore}%
                        </Badge>
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none
                      prose-headings:text-foreground 
                      prose-h2:text-sm sm:prose-h2:text-base 
                      prose-h3:text-xs sm:prose-h3:text-sm
                      prose-h2:mt-4 prose-h3:mt-3 prose-h2:mb-2 prose-h3:mb-1
                      prose-table:text-[10px] sm:prose-table:text-xs 
                      prose-td:px-1.5 prose-td:py-0.5 prose-th:px-1.5 prose-th:py-0.5
                      prose-table:border prose-th:border prose-td:border prose-th:bg-muted/50
                      prose-table:w-full prose-table:table-fixed
                      prose-ul:my-1.5 prose-li:my-0.5 
                      prose-p:my-1.5 prose-p:text-xs sm:prose-p:text-sm
                      prose-strong:text-foreground
                      [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:whitespace-normal">
                      <ReactMarkdown>{auditResult}</ReactMarkdown>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
