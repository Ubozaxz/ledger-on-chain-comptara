import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  isConnected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Header = ({ isConnected, walletAddress, onConnect, onDisconnect }: HeaderProps) => {
  const { toast } = useToast();

  const handleConnect = () => {
    // Simulation de connexion Metamask
    const mockAddress = "0x742d35Cc6475C4C9DA9f90123ABC456789DEF";
    onConnect();
    toast({
      title: "Portefeuille connecté",
      description: `Connecté à Hedera Testnet avec ${mockAddress.slice(0, 8)}...`,
      variant: "default",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="border-0 rounded-none shadow-sm bg-card border-b">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">comptara</h1>
          </div>
          <Badge variant="outline" className="text-xs">
            Hedera Testnet
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-3">
              <Card className="px-3 py-2 bg-muted">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-success" />
                  <span className="text-sm font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
              </Card>
              <Button variant="outline" size="sm" onClick={onDisconnect}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnecter
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnect} className="bg-primary hover:bg-primary-hover">
              <Wallet className="h-4 w-4 mr-2" />
              Connecter Metamask
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};