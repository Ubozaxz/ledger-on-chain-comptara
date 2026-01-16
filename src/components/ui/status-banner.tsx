import { Wifi, WifiOff, Wallet, Cloud, CloudOff, User, RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatusBannerProps {
  isAuthenticated: boolean;
  isOnline: boolean;
  walletConnected: boolean;
  walletType?: string | null;
  pendingSync: number;
  onSyncClick?: () => void;
}

export const StatusBanner = ({
  isAuthenticated,
  isOnline,
  walletConnected,
  walletType,
  pendingSync,
  onSyncClick,
}: StatusBannerProps) => {
  const hasIssue = !isAuthenticated || !isOnline || pendingSync > 0;

  if (!hasIssue && walletConnected) {
    return null; // All good, no banner needed
  }

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg",
      !isOnline 
        ? "bg-destructive/10 border border-destructive/20" 
        : pendingSync > 0
        ? "bg-warning/10 border border-warning/20"
        : "bg-muted/50 border"
    )}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Auth Status */}
        <div className="flex items-center space-x-1">
          <User className={cn("h-3 w-3", isAuthenticated ? "text-success" : "text-destructive")} />
          <span className={isAuthenticated ? "text-success" : "text-destructive"}>
            {isAuthenticated ? "Connecté" : "Non connecté"}
          </span>
        </div>

        {/* Network Status */}
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3 text-success" />
              <span className="text-success">En ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-destructive" />
              <span className="text-destructive">Hors-ligne</span>
            </>
          )}
        </div>

        {/* Wallet Status */}
        <div className="flex items-center space-x-1">
          <Wallet className={cn("h-3 w-3", walletConnected ? "text-success" : "text-muted-foreground")} />
          <span className={walletConnected ? "text-success" : "text-muted-foreground"}>
            {walletConnected ? walletType?.toUpperCase() || "Wallet" : "Pas de wallet"}
          </span>
        </div>

        {/* Cloud Sync Status */}
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <Cloud className="h-3 w-3 text-primary" />
          ) : (
            <CloudOff className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={isOnline ? "text-primary" : "text-muted-foreground"}>
            Cloud
          </span>
        </div>
      </div>

      {/* Pending Sync Indicator */}
      {pendingSync > 0 && (
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            {pendingSync} en attente
          </Badge>
          {isOnline && onSyncClick && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSyncClick}
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
