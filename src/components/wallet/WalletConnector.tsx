import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Shield, LogOut, Globe, Smartphone, Monitor, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { WalletType, connectMetaMask, connectHashPack, connectTrustWallet, isWalletInstalled, formatAddress, isMobile, isTrustWalletAvailable, isInWalletBrowser } from '@/lib/wallets';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import comptaraLogo from '@/assets/comptara-logo.jpg';

interface WalletConnectorProps {
  isConnected: boolean;
  walletAddress: string | null;
  walletType: WalletType | null;
  onConnect: (address: string, type: WalletType) => void;
  onDisconnect: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export const WalletConnector = ({ 
  isConnected, 
  walletAddress, 
  walletType, 
  onConnect, 
  onDisconnect,
  userEmail,
  onSignOut,
}: WalletConnectorProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState<WalletType | null>(null);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isMobileDevice = isMobile();
  const inWalletBrowser = isInWalletBrowser();

  // Auto-detect wallet in in-app browser
  useEffect(() => {
    if (inWalletBrowser && !isConnected) {
      // Small delay to let provider inject
      setTimeout(async () => {
        try {
          // Try MetaMask-compatible provider first
          const { getEthereum } = await import('@/lib/hedera');
          const ethereum = getEthereum();
          if (ethereum) {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              onConnect(accounts[0], ethereum.isTrust ? 'trust' : 'metamask');
            }
          }
        } catch {
          // Silent - user will connect manually
        }
      }, 500);
    }
  }, [inWalletBrowser, isConnected, onConnect]);

  const handleConnect = async (type: WalletType) => {
    setIsConnecting(type);
    setConnectionError(null);

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
      setConnectionError(errorMessage);
      
      toast({
        title: 'Échec de connexion',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(null);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const openInWallet = (walletType: 'metamask' | 'trust') => {
    const currentUrl = window.location.href;
    let deepLink = '';
    
    if (walletType === 'metamask') {
      const hostPath = `${window.location.host}${window.location.pathname}`;
      deepLink = `https://metamask.app.link/dapp/${hostPath}`;
    } else {
      deepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`;
    }
    
    window.location.href = deepLink;
  };

  return (
    <Card className="border-0 rounded-none shadow-md bg-background/85 border-b backdrop-blur-md sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="px-3 md:px-6 py-2 md:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl overflow-hidden flex-shrink-0 shadow-elegant">
              <img src={comptaraLogo} alt="Comptara" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-2xl font-bold text-gradient truncate">{t('appTitle')}</h1>
              <p className="text-[9px] md:text-xs text-muted-foreground hidden sm:block">{t('appSubtitle')}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] md:text-xs bg-success/10 text-success border-success/20 flex-shrink-0 hidden sm:flex">
            <div className="h-1.5 w-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
            Testnet
          </Badge>
        </div>

        <div className="flex items-center space-x-1.5 justify-end flex-shrink-0">
          <div className="flex items-center space-x-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="hover:bg-accent touch-manipulation h-8 w-8 p-0"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </div>

          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-1 md:space-x-2">
              <Card className="px-2 md:px-3 py-1 md:py-2 bg-gradient-card border-primary/20">
                <div className="flex items-center space-x-1">
                  <Wallet className="h-3 w-3 text-success flex-shrink-0" />
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
              </Card>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                className="hover:bg-destructive hover:text-destructive-foreground border-destructive/20 h-8 px-2 touch-manipulation"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="ml-1 hidden md:inline text-xs">{t('disconnect')}</span>
              </Button>
            </div>
          ) : (
            <Dialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm border-primary/30 touch-manipulation">
                  <Wallet className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{t('connectWallet')}</span>
                  <span className="sm:hidden">Wallet</span>
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
                  {/* Connection Error */}
                  {connectionError && (
                    <div className="flex items-start space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{connectionError}</p>
                    </div>
                  )}

                  {/* MetaMask */}
                  <div className="space-y-2">
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
                              <span>{inWalletBrowser ? 'Connecter' : 'Ouvrir dans MetaMask'}</span>
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
                    {isMobileDevice && !isWalletInstalled('metamask') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => openInWallet('metamask')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir dans l'app MetaMask
                      </Button>
                    )}
                  </div>

                  {/* Trust Wallet */}
                  <div className="space-y-2">
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
                              <span>{inWalletBrowser ? 'Connecter' : 'Ouvrir dans Trust'}</span>
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
                    {isMobileDevice && !isTrustWalletAvailable() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => openInWallet('trust')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir dans l'app Trust Wallet
                      </Button>
                    )}
                  </div>

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
                  {isMobileDevice && !inWalletBrowser && (
                    <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
                      <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium">Sur mobile?</p>
                        <p>Ouvrez ce site dans le navigateur intégré de votre wallet (MetaMask ou Trust Wallet) pour une connexion directe.</p>
                      </div>
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

          {onSignOut && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              title={userEmail ? `Se déconnecter (${userEmail})` : 'Se déconnecter'}
              aria-label="Se déconnecter"
              className="h-8 md:h-10 px-2 md:px-3 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground touch-manipulation"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1 text-xs hidden min-[420px]:inline">Déconnexion</span>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
