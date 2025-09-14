import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, LogOut } from "lucide-react";

interface HeaderProps {
  isConnected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Header = ({ isConnected, walletAddress, onConnect, onDisconnect }: HeaderProps) => {
  const handleConnect = () => {
    // Déclenche la connexion réelle via le parent (Index)
    onConnect();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="border-0 rounded-none shadow-lg bg-gradient-card border-b backdrop-blur-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">comptara</h1>
              <p className="text-xs text-muted-foreground">Comptabilité blockchain</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
            <div className="h-1.5 w-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
            Hedera Testnet
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-3">
              <Card className="px-4 py-2 bg-gradient-card border-primary/20">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-success" />
                  <span className="text-sm font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
              </Card>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDisconnect}
                className="hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnecter
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleConnect} 
              className="bg-gradient-primary hover:opacity-90 glow transition-all duration-300"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Connecter MetaMask
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};