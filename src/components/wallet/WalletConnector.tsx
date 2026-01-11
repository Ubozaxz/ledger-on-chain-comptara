import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Shield, LogOut, Globe, Smartphone, Monitor } from 'lucide-react';
import { WalletType, connectMetaMask, connectHashPack, isWalletInstalled, formatAddress } from '@/lib/wallets';
import { connectTrustWallet, isTrustWalletInstalled, isMobile } from '@/lib/walletconnect';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);

  const handleConnect = async (type: WalletType | 'trustwallet') => {
    setIsConnecting(true);
    try {
      let address: string;
      
      if (type === 'metamask') {
        address = await connectMetaMask();
      } else if (type === 'trustwallet') {
        const result = await connectTrustWallet();
        if (!result) {
          throw new Error('Connexion Trust Wallet annulée');
        }
        address = result;
      } else {
        address = await connectHashPack();
      }
      
      onConnect(address, type === 'trustwallet' ? 'metamask' : type);
      setShowWalletDialog(false);
      
      toast({
        title: t('entrySuccess'),
        description: `${type === 'trustwallet' ? 'Trust Wallet' : t(type)} connecté - ${formatAddress(address)}`,
      });
    } catch (error) {
      console.error('Wallet connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      toast({
        title: t('connectionError'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
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
                  <DialogTitle className="text-center text-lg md:text-xl">{t('connectWallet')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  {/* Trust Wallet - Mobile & Extension */}
                  <Button
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 touch-manipulation"
                    onClick={() => handleConnect('trustwallet')}
                    disabled={isConnecting}
                  >
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <img 
                        src="https://trustwallet.com/assets/images/media/assets/trust_platform.svg" 
                        alt="Trust Wallet"
                        className="h-6 w-6"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMzM3NUJCIi8+PHRleHQgeD0iMTYiIHk9IjIwIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPuKImzwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm md:text-base">Trust Wallet</div>
                      <div className="text-xs text-white/70 flex items-center space-x-1">
                        {isMobile() ? (
                          <>
                            <Smartphone className="h-3 w-3" />
                            <span>Mobile App</span>
                          </>
                        ) : (
                          <>
                            <Monitor className="h-3 w-3" />
                            <span>Extension Web</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isTrustWalletInstalled() && (
                      <Badge variant="secondary" className="bg-white/20 text-white text-[10px]">
                        Installé
                      </Badge>
                    )}
                  </Button>

                  {/* MetaMask */}
                  <Button
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 bg-gradient-primary hover:opacity-90 touch-manipulation"
                    onClick={() => handleConnect('metamask')}
                    disabled={isConnecting || !isWalletInstalled('metamask')}
                  >
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" 
                        alt="MetaMask"
                        className="h-6 w-6"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjRTI3NjI1Ii8+PHRleHQgeD0iMTYiIHk9IjIwIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPk08L3RleHQ+PC9zdmc+';
                        }}
                      />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm md:text-base">{t('metamask')}</div>
                      <div className="text-xs text-white/70">Browser Extension</div>
                    </div>
                  </Button>

                  {/* HashPack */}
                  <Button
                    className="w-full h-14 md:h-16 flex items-center justify-start space-x-3 md:space-x-4 bg-gradient-secondary hover:opacity-90 touch-manipulation"
                    onClick={() => handleConnect('hashpack')}
                    disabled={isConnecting}
                  >
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                      <div className="h-6 w-6 bg-blue-600 rounded"></div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm md:text-base">{t('hashpack')}</div>
                      <div className="text-xs text-white/70">Hedera Native Wallet</div>
                    </div>
                  </Button>

                  {/* Wallet not installed warnings */}
                  {!isWalletInstalled('metamask') && (
                    <p className="text-xs text-muted-foreground text-center px-2">
                      MetaMask non détecté.{' '}
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Installer
                      </a>
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </Card>
  );
};