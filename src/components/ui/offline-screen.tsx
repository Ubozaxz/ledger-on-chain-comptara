import { WifiOff, RefreshCw, CloudOff, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OfflineScreenProps {
  pendingSync?: number;
  onRetry?: () => void;
}

/**
 * Full-screen offline state. Mobile-first, accessible, clear messaging.
 * Shown when navigator is offline so the user understands why nothing loads.
 */
export const OfflineScreen = ({ pendingSync = 0, onRetry }: OfflineScreenProps) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 safe-area-bottom">
      <Card className="w-full max-w-md card-modern">
        <CardContent className="p-6 sm:p-8 space-y-5 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-warning" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-semibold">Aucune connexion réseau</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vous êtes hors-ligne. L'application reste utilisable et vos écritures
              seront synchronisées automatiquement dès le retour du réseau.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border bg-muted/30 p-3 flex flex-col items-center gap-1">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">Saisie locale</span>
              <span className="text-muted-foreground text-[10px]">Active</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 flex flex-col items-center gap-1">
              <CloudOff className="h-4 w-4 text-warning" />
              <span className="font-medium">Cloud Sync</span>
              <span className="text-muted-foreground text-[10px]">
                {pendingSync > 0 ? `${pendingSync} en attente` : "Suspendu"}
              </span>
            </div>
          </div>

          <Button
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            className="w-full h-11 touch-manipulation bg-gradient-primary hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer la connexion
          </Button>

          <p className="text-[10px] text-muted-foreground">
            Astuce : activez les données mobiles ou un Wi-Fi pour synchroniser maintenant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
