import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Shield, LogOut, Globe, Smartphone, Monitor, Loader2, Copy, ExternalLink, Check } from 'lucide-react';
import { WalletType, connectMetaMask, connectHashPack, connectTrustWallet, isWalletInstalled, formatAddress, isMobile, isTrustWalletAvailable } from '@/lib/wallets';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface WalletConnectorProps {
  isConnected: boolean;
  walletAddress: string | null;
  walletType: WalletType | null;
  onConnect: (address: string, type: WalletType) => void;
  onDisconnect: () => void;
}

export const WalletConnector = ({ 
  isConnected, 
  walletAddress, 
  walletType, 
  onConnect, 
  onDisconnect 
}: WalletConnectorProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState<WalletType | null>(null);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const isMobileDevice = isMobile();

  const handleConnect = async (type: WalletType) => {
    setIsConnecting(type);
    try {
      let address: string;
      
      if (type === 'metamask') {
        address = await connectMetaMask();
      } else if (type === 'trust') {
        address = await connectTrustWallet();
      } else {
        address = await connectHashPack();
      }
      
      onConnect(address, type);
      setShowWalletDialog(false);
      
      toast({
        title: 'Wallet connecté',
        description: `${type.toUpperCase()} connecté sur Hedera Testnet`,
      });
    } catch (error) {
      console.error('Wallet connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      // Don't show error for redirect messages
      if (!errorMessage.includes('Ouverture')) {
        toast({
          title: 'Échec de connexion',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsConnecting(null);
    }
  };

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Adresse copiée',
        description: 'Adresse copiée dans le presse-papier'
      });
    }
  };

  const handleViewExplorer = () => {
    if (walletAddress) {
      window.open(`https://hashscan.io/testnet/account/${walletAddress}`, '_blank');
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'trust': return '🔵';
      case 'metamask': return '🦊';
      case 'hashpack': return '📦';
      default: return '💳';
    }
  };

  return (
    <Card className="border-0 rounded-none shadow-lg bg-gradient-card border-b backdrop-blur-sm">
      <div className="px-3 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex items-center space-x-2 md:space-x-4 w-full sm:w-auto">
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 md:h-6 md:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gradient truncate">{t('appTitle')}</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">{t('appSubtitle')}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] md:text-xs bg-success/10 text-success border-success/20 flex-shrink-0 hidden sm:flex">
            <div className="h-1.5 w-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
            {t('hederaTestnet')}
          </Badge>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="hover:bg-accent touch-manipulation h-9 w-9 p-0"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </div>

          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-2 md:space-x-3">
              <Card className="px-2 md:px-4 py-1.5 md:py-2 bg-gradient-card border-primary/20">
                <div className="flex items-center space-x-1 md:space-x-2">
                  <Wallet className="h-3 w-3 md:h-4 md:w-4 text-success" />
                  <span className="text-xs md:text-sm font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                  <Badge variant="secondary" className="text-[10px] md:text-xs hidden sm:inline-flex">
                    {t(walletType || 'metamask')}
                  </Badge>
                </div>
              </Card>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDisconnect}
                className="hover:bg-destructive hover:text-destructive-foreground border-destructive/20 h-9 px-2 md:px-3"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-2 hidden md:inline">{t('disconnect')}</span>
              </Button>
            </div>
          ) : (
            <Dialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:opacity-90 glow transition-all duration-300 h-9 md:h-10 px-3 md:px-4 text-sm">
                  <Wallet className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t('connectWallet')}</span>
                  <span className="sm:hidden">Connexion</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-center text-lg md:text-xl flex items-center justify-center space-x-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    <span>Connecter un wallet</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  {/* MetaMask */}
                  <Button
                    variant="outline"
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 hover:bg-primary/10 touch-manipulation"
                    onClick={() => handleConnect('metamask')}
                    disabled={isConnecting !== null}
                  >
                    {isConnecting === 'metamask' ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <span className="text-2xl">🦊</span>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base">MetaMask</div>
                      <div className="text-xs text-muted-foreground flex items-center space-x-1">
                        {isMobileDevice ? (
                          <>
                            <Smartphone className="h-3 w-3" />
                            <span>App mobile ou extension</span>
                          </>
                        ) : (
                          <>
                            <Monitor className="h-3 w-3" />
                            <span>Extension navigateur</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isWalletInstalled('metamask') && (
                      <Badge variant="secondary" className="text-[10px]">
                        Détecté
                      </Badge>
                    )}
                  </Button>

                  {/* Trust Wallet */}
                  <Button
                    variant="outline"
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 hover:bg-primary/10 touch-manipulation"
                    onClick={() => handleConnect('trust')}
                    disabled={isConnecting !== null}
                  >
                    {isConnecting === 'trust' ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <span className="text-2xl">🔵</span>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base">Trust Wallet</div>
                      <div className="text-xs text-muted-foreground flex items-center space-x-1">
                        {isMobileDevice ? (
                          <>
                            <Smartphone className="h-3 w-3" />
                            <span>App mobile</span>
                          </>
                        ) : (
                          <>
                            <Monitor className="h-3 w-3" />
                            <span>Extension navigateur</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isTrustWalletAvailable() && (
                      <Badge variant="secondary" className="text-[10px]">
                        Détecté
                      </Badge>
                    )}
                  </Button>

                  {/* HashPack */}
                  <Button
                    variant="outline"
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 hover:bg-primary/10 touch-manipulation"
                    onClick={() => handleConnect('hashpack')}
                    disabled={isConnecting !== null}
                  >
                    {isConnecting === 'hashpack' ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-sm md:text-base">HashPack</div>
                      <div className="text-xs text-muted-foreground">Hedera Native Wallet</div>
                    </div>
                  </Button>

                  {/* Mobile info */}
                  {isMobileDevice && (
                    <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
                      <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Sur mobile, l'app wallet s'ouvrira automatiquement.
                      </p>
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <p className="text-xs text-muted-foreground">
                      Réseau: <span className="text-success font-medium">Hedera Testnet</span>
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </Card>
  );
};