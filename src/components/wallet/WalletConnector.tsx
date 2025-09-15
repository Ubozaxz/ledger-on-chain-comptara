import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Shield, LogOut, Globe } from 'lucide-react';
import { WalletType, connectMetaMask, connectHashPack, isWalletInstalled, formatAddress } from '@/lib/wallets';
import { useToast } from '@/hooks/use-toast';

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

  const handleConnect = async (type: WalletType) => {
    setIsConnecting(true);
    try {
      let address: string;
      
      if (type === 'metamask') {
        address = await connectMetaMask();
      } else {
        address = await connectHashPack();
      }
      
      onConnect(address, type);
      setShowWalletDialog(false);
      
      toast({
        title: t('entrySuccess'),
        description: `${t(type)} ${t('connectionSuccess')} - ${formatAddress(address)}`,
      });
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast({
        title: t('connectionError'),
        description: error instanceof Error ? error.message : 'Unknown error',
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
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">{t('appTitle')}</h1>
              <p className="text-xs text-muted-foreground">{t('appSubtitle')}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
            <div className="h-1.5 w-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
            {t('hederaTestnet')}
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="hover:bg-accent"
          >
            <Globe className="h-4 w-4 mr-2" />
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </Button>

          {isConnected && walletAddress ? (
            <div className="flex items-center space-x-3">
              <Card className="px-4 py-2 bg-gradient-card border-primary/20">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-success" />
                  <span className="text-sm font-mono text-foreground">
                    {formatAddress(walletAddress)}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {t(walletType || 'metamask')}
                  </Badge>
                </div>
              </Card>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onDisconnect}
                className="hover:bg-destructive hover:text-destructive-foreground border-destructive/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('disconnect')}
              </Button>
            </div>
          ) : (
            <Dialog open={showWalletDialog} onOpenChange={setShowWalletDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary hover:opacity-90 glow transition-all duration-300">
                  <Wallet className="h-4 w-4 mr-2" />
                  {t('connectWallet')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-center">{t('connectWallet')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Button
                    className="w-full h-16 flex items-center justify-start space-x-4 bg-gradient-primary hover:opacity-90"
                    onClick={() => handleConnect('metamask')}
                    disabled={isConnecting || !isWalletInstalled('metamask')}
                  >
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                      <img 
                        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI3LjQ2IDEwLjc1TDE3LjkyIDIuNTVMMTUuNzggNy44M0wyNi4yOCAxMy4yNUwyNy40NiAxMC43NVoiIGZpbGw9IiNFMjc2MjYiLz4KPHN2Zz4K" 
                        alt="MetaMask"
                        className="h-6 w-6"
                      />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">{t('metamask')}</div>
                      <div className="text-sm text-white/70">Browser Extension</div>
                    </div>
                  </Button>

                  <Button
                    className="w-full h-16 flex items-center justify-start space-x-4 bg-gradient-secondary hover:opacity-90"
                    onClick={() => handleConnect('hashpack')}
                    disabled={isConnecting}
                  >
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                      <div className="h-6 w-6 bg-blue-600 rounded"></div>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">{t('hashpack')}</div>
                      <div className="text-sm text-white/70">Hedera Native Wallet</div>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </Card>
  );
};