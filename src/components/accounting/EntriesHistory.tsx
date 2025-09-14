import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Hash, ExternalLink, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Entry {
  id: string;
  date: string;
  libelle: string;
  montant: string;
  devise: string;
  compteDebit: string;
  compteCredit: string;
  txHash: string;
  timestamp: string;
  status: string;
}

interface EntriesHistoryProps {
  entries: Entry[];
}

export const EntriesHistory = ({ entries }: EntriesHistoryProps) => {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('fr-FR');
  };

  const handleViewExplorer = (txHash: string) => {
    import("@/lib/hedera").then(({ getExplorerTxUrl }) => {
      const url = getExplorerTxUrl(txHash);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  const handleGenerateProof = (entry: Entry) => {
    toast({
      title: "Justificatif généré",
      description: `Document de preuve pour la transaction ${entry.txHash.slice(0, 8)}...`,
    });
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5 text-primary" />
            <span>Historique des écritures</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune écriture enregistrée pour le moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="h-5 w-5 text-primary" />
          <span>Historique des écritures ({entries.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.id} className="border border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium text-foreground">{entry.libelle}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(entry.date)} • {formatTimestamp(entry.timestamp)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg text-foreground">
                      {entry.montant} {entry.devise}
                    </p>
                    <Badge variant={entry.status === 'success' ? 'default' : 'destructive'}>
                      {entry.status === 'success' ? 'Confirmé' : 'Échec'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Débit: </span>
                    <span className="text-foreground">{entry.compteDebit}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Crédit: </span>
                    <span className="text-foreground">{entry.compteCredit}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {entry.txHash}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewExplorer(entry.txHash)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Explorer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateProof(entry)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Justificatif
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