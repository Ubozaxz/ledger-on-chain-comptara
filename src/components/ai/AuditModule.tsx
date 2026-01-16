import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuditModuleProps {
  entries: any[];
  payments: any[];
}

export const AuditModule = ({ entries, payments }: AuditModuleProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const { toast } = useToast();

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

    try {
      const ledgerData = {
        entries: entries.map(e => ({
          id: e.id,
          date: e.date,
          debit: e.debit,
          credit: e.credit,
          montant: e.montant,
          description: e.description,
          txHash: e.txHash,
          categorie: e.categorie,
        })),
        payments: payments.map(p => ({
          id: p.id,
          date: p.date,
          type: p.type,
          montant: p.montant,
          devise: p.devise,
          destinataire: p.destinataire,
          objet: p.objet,
          txHash: p.txHash,
        })),
        summary: {
          totalEntries: entries.length,
          totalPayments: payments.length,
          totalDebits: entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0),
          totalPaymentAmount: payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0),
        },
      };

      const { buildJsonHeaders } = await import('@/lib/auth-headers');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: await buildJsonHeaders(),
        body: JSON.stringify({
          action: "audit",
          ledgerData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to run audit");
      }

      // Parse streaming response
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

      // Calculate health score from response
      const score = calculateHealthScore(fullResponse, entries, payments);
      setHealthScore(score);

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
    // Simple health score calculation
    let score = 100;
    
    // Check for anomaly keywords
    const anomalyKeywords = ['anomalie', 'erreur', 'incohérence', 'double', 'problème', 'risque'];
    const lowerAnalysis = analysis.toLowerCase();
    anomalyKeywords.forEach(keyword => {
      if (lowerAnalysis.includes(keyword)) {
        score -= 10;
      }
    });

    // Positive indicators
    const positiveKeywords = ['correct', 'cohérent', 'équilibré', 'bon', 'satisfaisant'];
    positiveKeywords.forEach(keyword => {
      if (lowerAnalysis.includes(keyword)) {
        score += 5;
      }
    });

    // Data completeness
    if (entries.length < 5) score -= 10;
    if (payments.length < 3) score -= 5;

    return Math.max(0, Math.min(100, score));
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { text: "Excellent", variant: "default" as const };
    if (score >= 60) return { text: "Attention", variant: "secondary" as const };
    return { text: "Critique", variant: "destructive" as const };
  };

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Module d'Audit IA</span>
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
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{entries.length}</p>
            <p className="text-xs text-muted-foreground">Écritures</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{payments.length}</p>
            <p className="text-xs text-muted-foreground">Paiements</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Total Débit</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Total Paiements</p>
          </div>
        </div>

        {/* Health Score */}
        {healthScore !== null && (
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {healthScore >= 60 ? (
                  <TrendingUp className={`h-5 w-5 ${getHealthColor(healthScore)}`} />
                ) : (
                  <TrendingDown className={`h-5 w-5 ${getHealthColor(healthScore)}`} />
                )}
                <span className="font-medium">Score de Santé Financière</span>
              </div>
              <Badge variant={getHealthBadge(healthScore).variant}>
                {getHealthBadge(healthScore).text}
              </Badge>
            </div>
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 ${
                  healthScore >= 80 ? 'bg-success' : 
                  healthScore >= 60 ? 'bg-warning' : 'bg-destructive'
                } transition-all duration-500`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <p className={`text-center mt-2 text-2xl font-bold ${getHealthColor(healthScore)}`}>
              {healthScore}%
            </p>
          </div>
        )}

        {/* Audit Results */}
        {auditResult && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">Rapport d'Audit</span>
            </div>
            <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {auditResult}
                </pre>
              </div>
            </ScrollArea>
          </div>
        )}

        {!auditResult && !isAnalyzing && (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cliquez sur "Lancer l'audit" pour analyser vos données</p>
            <p className="text-xs mt-1">L'IA détectera les anomalies et évaluera votre santé financière</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
