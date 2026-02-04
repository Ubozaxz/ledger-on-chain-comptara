import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Calendar,
  PiggyBank,
  Target,
  Zap
} from "lucide-react";

interface SmartSuggestionsProps {
  entries: any[];
  payments: any[];
  onSuggestionClick?: (action: string, data?: any) => void;
}

interface Suggestion {
  id: string;
  type: "insight" | "action" | "warning" | "optimization";
  title: string;
  description: string;
  icon: any;
  priority: "high" | "medium" | "low";
  actionLabel?: string;
  actionType?: string;
  data?: any;
}

export const SmartSuggestions = ({ entries, payments, onSuggestionClick }: SmartSuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    generateSuggestions();
  }, [entries, payments]);

  const generateSuggestions = () => {
    const newSuggestions: Suggestion[] = [];
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    // Analyse des données
    const totalEntries = entries.length;
    const totalPayments = payments.length;
    const totalEntriesAmount = entries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const totalPaymentsAmount = payments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);

    // Écritures ce mois
    const monthlyEntries = entries.filter(e => {
      const d = new Date(e.date || e.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    // Paiements ce mois
    const monthlyPayments = payments.filter(p => {
      const d = new Date(p.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    // 1. Suggestion si peu d'activité
    if (totalEntries === 0 && totalPayments === 0) {
      newSuggestions.push({
        id: "first-entry",
        type: "action",
        title: "Commencez votre comptabilité",
        description: "Créez votre première écriture comptable pour démarrer le suivi de vos finances on-chain.",
        icon: Sparkles,
        priority: "high",
        actionLabel: "Créer une écriture",
        actionType: "navigate-journal"
      });
    }

    // 2. Suggestion audit si assez de données
    if (totalEntries >= 3 || totalPayments >= 3) {
      const lastAudit = localStorage.getItem("lastAuditDate");
      const daysSinceAudit = lastAudit 
        ? Math.floor((Date.now() - new Date(lastAudit).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceAudit > 7) {
        newSuggestions.push({
          id: "run-audit",
          type: "optimization",
          title: "Lancez un audit IA",
          description: `Vous avez ${totalEntries + totalPayments} transactions. L'IA peut détecter des anomalies et optimiser votre comptabilité.`,
          icon: Target,
          priority: "high",
          actionLabel: "Lancer l'audit",
          actionType: "run-audit"
        });
      }
    }

    // 3. Avertissement si déséquilibre débit/crédit
    const totalDebits = entries.filter(e => e.debit).reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const totalCredits = entries.filter(e => e.credit).reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    
    if (totalDebits > 0 && totalCredits > 0) {
      const ratio = totalDebits / totalCredits;
      if (ratio > 1.5) {
        newSuggestions.push({
          id: "debit-warning",
          type: "warning",
          title: "Déséquilibre détecté",
          description: `Vos débits (${totalDebits.toFixed(2)}) sont ${((ratio - 1) * 100).toFixed(0)}% plus élevés que vos crédits. Vérifiez vos écritures.`,
          icon: AlertTriangle,
          priority: "high",
          actionLabel: "Voir les écritures",
          actionType: "navigate-journal"
        });
      }
    }

    // 4. Insight sur la tendance mensuelle
    if (monthlyEntries.length > 0 || monthlyPayments.length > 0) {
      const monthlyTotal = monthlyEntries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0) +
                          monthlyPayments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);
      
      newSuggestions.push({
        id: "monthly-insight",
        type: "insight",
        title: `${monthlyTotal.toLocaleString()} HBAR ce mois`,
        description: `Vous avez enregistré ${monthlyEntries.length} écritures et ${monthlyPayments.length} paiements ce mois.`,
        icon: Calendar,
        priority: "medium"
      });
    }

    // 5. Suggestion d'export si beaucoup de données
    if (totalEntries >= 10 || totalPayments >= 5) {
      newSuggestions.push({
        id: "export-suggestion",
        type: "action",
        title: "Exportez vos données",
        description: "Générez un rapport PDF ou CSV pour vos archives comptables et fiscales.",
        icon: PiggyBank,
        priority: "low",
        actionLabel: "Exporter",
        actionType: "export"
      });
    }

    // 6. Suggestion Voice-to-Entry si peu utilisé
    const hasVoiceEntries = entries.some(e => e.description?.includes("vocal"));
    if (!hasVoiceEntries && totalEntries < 5) {
      newSuggestions.push({
        id: "try-voice",
        type: "action",
        title: "Essayez la saisie vocale",
        description: "Dictez vos écritures comptables - l'IA extrait automatiquement les données.",
        icon: Zap,
        priority: "medium",
        actionLabel: "Essayer",
        actionType: "navigate-ai"
      });
    }

    // 7. Félicitations si bonne régularité
    if (monthlyEntries.length >= 5 && monthlyPayments.length >= 3) {
      newSuggestions.push({
        id: "good-activity",
        type: "insight",
        title: "Excellente régularité !",
        description: "Vous maintenez une comptabilité régulière. Continuez ainsi pour un meilleur suivi.",
        icon: CheckCircle,
        priority: "low"
      });
    }

    // 8. Suggestion catégorisation
    const uncategorizedEntries = entries.filter(e => !e.category || e.category === "");
    if (uncategorizedEntries.length > 3) {
      newSuggestions.push({
        id: "categorize",
        type: "optimization",
        title: "Catégorisez vos écritures",
        description: `${uncategorizedEntries.length} écritures sans catégorie. Ajoutez des catégories pour de meilleures analyses.`,
        icon: Target,
        priority: "medium",
        actionLabel: "Voir les écritures",
        actionType: "navigate-journal"
      });
    }

    // Trier par priorité
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    newSuggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    setSuggestions(newSuggestions.slice(0, 4)); // Max 4 suggestions
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-primary/10 text-primary border-primary/20";
      case "medium": return "bg-warning/10 text-warning border-warning/20";
      case "low": return "bg-muted text-muted-foreground border-muted";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string, Icon: any) => {
    const colors: Record<string, string> = {
      insight: "text-primary",
      action: "text-success",
      warning: "text-warning",
      optimization: "text-purple-500"
    };
    return <Icon className={`h-5 w-5 ${colors[type] || "text-primary"}`} />;
  };

  if (suggestions.length === 0) return null;

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          <span>Suggestions Intelligentes</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {suggestions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => (
          <div 
            key={suggestion.id}
            className={`flex items-start space-x-3 p-3 rounded-lg border ${getPriorityColor(suggestion.priority)} transition-all hover:shadow-md`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getTypeIcon(suggestion.type, suggestion.icon)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="font-medium text-sm text-foreground">{suggestion.title}</p>
                {suggestion.priority === "high" && (
                  <TrendingUp className="h-3 w-3 text-primary animate-pulse" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {suggestion.description}
              </p>
              {suggestion.actionLabel && onSuggestionClick && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs hover:bg-background"
                  onClick={() => onSuggestionClick(suggestion.actionType || "", suggestion.data)}
                >
                  {suggestion.actionLabel}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};