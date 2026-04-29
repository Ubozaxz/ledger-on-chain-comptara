import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut } from "lucide-react";
import comptaraLogo from "@/assets/comptara-logo.jpg";

interface HeaderProps {
  isConnected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Header = ({ isConnected, walletAddress, onConnect, onDisconnect }: HeaderProps) => {
  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Card className="border-0 rounded-none shadow-lg bg-gradient-card border-b backdrop-blur-sm">
      <div className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img
              src={comptaraLogo}
              alt="Comptara logo"
              className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg object-cover flex-shrink-0 ring-1 ring-primary/30 shadow-md"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gradient">comptara</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Comptabilité blockchain</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] sm:text-xs bg-success/10 text-success border-success/20 hidden sm:flex">
            <div className="h-1.5 w-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
            Hedera Testnet
          </Badge>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              <Card className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-card border-primary/20">
                <div className="flex items-center space-x-1.5">
                  <Wallet className="h-3.5 w-3.5 text-success" />
                  <span className="text-[10px] sm:text-sm font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
              </Card>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDisconnect}
                className="hover:bg-destructive hover:text-destructive-foreground border-destructive/20 h-8 px-2 sm:px-3"
              >
                <LogOut className="h-3.5 w-3.5 sm:mr-2" />
                <span className="hidden sm:inline text-xs">Déconnecter</span>
              </Button>
            </div>
          ) : (
            <Button 
              onClick={onConnect} 
              className="bg-gradient-primary hover:opacity-90 glow h-8 sm:h-9 text-xs sm:text-sm px-3"
            >
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Connecter MetaMask</span>
              <span className="sm:hidden">Wallet</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
