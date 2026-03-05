import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Hash, ExternalLink, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AccountingEntry } from "@/hooks/useCloudData";

interface EntriesHistoryProps {
  entries: AccountingEntry[];
}

export const EntriesHistory = ({ entries }: EntriesHistoryProps) => {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const handleViewExplorer = (txHash: string | null) => {
    if (!txHash) return;
    import("@/lib/hedera").then(({ getExplorerTxUrl }) => {
      const url = getExplorerTxUrl(txHash);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const handleGenerateProof = async (entry: AccountingEntry) => {
    try {
      const { generateEntryProofPDF } = await import("@/lib/pdf-generator");
      await generateEntryProofPDF(entry);
      toast({
        title: "Justificatif généré",
        description: `PDF téléchargé`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le justificatif",
        variant: "destructive",
      });
    }
  };

  if (entries.length === 0) {
    return (
      <Card className="card-modern">
        <CardHeader className="p-4">
          <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
            <History className="h-5 w-5 text-primary" />
            <span>Historique des écritures</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune écriture enregistrée</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
          <History className="h-5 w-5 text-primary" />
          <span>Historique ({entries.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-6 pt-0">
        {entries.map((entry) => (
          <Card key={entry.id} className="border border-border/50">
            <CardContent className="p-3">
              <div className="flex flex-col space-y-2">
                {/* Top row: label + amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-foreground text-sm truncate">{entry.libelle}</h4>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {formatDate(entry.date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm sm:text-base text-foreground">
                      {Number(entry.montant).toLocaleString('fr-FR')} {entry.devise || 'XOF'}
                    </p>
                    <Badge variant="default" className="text-[10px]">Confirmé</Badge>
                  </div>
                </div>

                {/* Debit / Credit */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Débit: </span>
                    <span className="text-foreground">{entry.debit || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Crédit: </span>
                    <span className="text-foreground">{entry.credit || '-'}</span>
                  </div>
                </div>

                {/* Hash + actions — MOBILE OPTIMIZED */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-border/30">
                  <div className="flex items-center space-x-1 min-w-0">
                    <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-[10px] text-muted-foreground truncate">
                      {entry.tx_hash ? entry.tx_hash.slice(0, 16) + '...' : 'Pas de hash'}
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewExplorer(entry.tx_hash)}
                      disabled={!entry.tx_hash}
                      className="h-8 px-2 text-[10px] sm:text-xs touch-manipulation"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Explorer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateProof(entry)}
                      className="h-8 px-2 text-[10px] sm:text-xs touch-manipulation"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
