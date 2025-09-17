import { useEffect, useState } from "react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { WalletType } from "@/lib/wallets";
import { JournalEntry } from "@/components/accounting/JournalEntry";
import { EntriesHistory } from "@/components/accounting/EntriesHistory";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, CreditCard, FileBarChart, Download, BarChart3, Wallet, Hash } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const { toast } = useToast();

  // Load data from localStorage
  const loadStoredData = (address: string) => {
    const storedEntries = localStorage.getItem(`comptara_entries_${address}`);
    const storedPayments = localStorage.getItem(`comptara_payments_${address}`);
    
    if (storedEntries) {
      setEntries(JSON.parse(storedEntries));
    }
    if (storedPayments) {
      setPayments(JSON.parse(storedPayments));
    }
  };

  // Save data to localStorage
  const saveDataToStorage = (address: string, newEntries?: any[], newPayments?: any[]) => {
    if (newEntries) {
      localStorage.setItem(`comptara_entries_${address}`, JSON.stringify(newEntries));
    }
    if (newPayments) {
      localStorage.setItem(`comptara_payments_${address}`, JSON.stringify(newPayments));
    }
  };

  // Auto-detect previously connected wallet (MetaMask/HashPack)
  const onWalletConnected = (address: string, type: WalletType) => {
    setIsConnected(true);
    setWalletAddress(address);
    setWalletType(type);
    loadStoredData(address); // Load stored data for this wallet
    toast({ title: 'Wallet connected', description: `${type.toUpperCase()} - ${address.slice(0,8)}...` });
  };

  useEffect(() => {
    (async () => {
      try {
        const { getMetaMaskAddress, getHashPackAddress } = await import('@/lib/wallets');
        const meta = await getMetaMaskAddress();
        if (meta) {
          onWalletConnected(meta, 'metamask');
          return;
        }
        const hash = await getHashPackAddress();
        if (hash) {
          onWalletConnected(hash, 'hashpack');
        }
      } catch (e) {
        // silent
      }
    })();
  }, []);

  const handleConnect = async () => {
    try {
      const { ensureHederaTestnet, connectWallet } = await import("@/lib/hedera");
      await ensureHederaTestnet();
      const account = await connectWallet();
      setIsConnected(true);
      setWalletAddress(account);
      setWalletType('metamask');
      loadStoredData(account); // Load stored data for this wallet
      toast({
        title: "Portefeuille connecté",
        description: `Connecté à Hedera Testnet avec ${account.slice(0, 8)}...`,
      });
    } catch (err: any) {
      toast({ title: "Connexion échouée", description: err?.message || "Vérifiez MetaMask", variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setWalletAddress(null);
    setWalletType(null);
    toast({ title: "Déconnecté", description: "Portefeuille déconnecté" });
  };

  const handleEntryAdded = (entry: any) => {
    const newEntries = [entry, ...entries];
    setEntries(newEntries);
    if (walletAddress) {
      saveDataToStorage(walletAddress, newEntries, undefined);
    }
  };

  const handlePaymentAdded = (payment: any) => {
    const newPayments = [payment, ...payments];
    setPayments(newPayments);
    if (walletAddress) {
      saveDataToStorage(walletAddress, undefined, newPayments);
    }
  };

  const handleExportData = async () => {
    try {
      const { generateFullExportPDF } = await import("@/lib/pdf-generator");
      
      // JSON Export
      const exportData = {
        entries,
        payments,
        exportDate: new Date().toISOString(),
        walletAddress,
        platform: "comptara",
        network: "Hedera Testnet",
      };
      
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement("a");
      jsonLink.href = jsonUrl;
      jsonLink.download = `comptara_export_${new Date().toISOString().split('T')[0]}.json`;
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);
      
      // PDF Export
      generateFullExportPDF(entries, payments, walletAddress);
      
      toast({
        title: "Export généré",
        description: "Fichiers JSON et PDF téléchargés avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible de générer l'export",
        variant: "destructive",
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <WalletConnector 
        isConnected={isConnected}
        walletAddress={walletAddress}
        walletType={walletType}
        onConnect={onWalletConnected}
        onDisconnect={handleDisconnect}
      />
        
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Card className="w-full max-w-md mx-4 card-modern">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl text-gradient">Connexion requise</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                Connectez votre portefeuille MetaMask pour accéder à <strong>comptara</strong> et commencer à enregistrer vos écritures comptables sur Hedera Testnet.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-success rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Hedera Testnet</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-primary rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Transactions sécurisées</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-warning rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Audit trail complet</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Button 
                  onClick={handleConnect} 
                  className="flex-1 mr-2 bg-gradient-primary hover:opacity-90 transition-all duration-300 glow touch-manipulation"
                  size="lg"
                >
                  <Wallet className="h-5 w-5 mr-2" />
                  Connecter MetaMask
                </Button>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <WalletConnector 
        isConnected={isConnected}
        walletAddress={walletAddress}
        walletType={walletType}
        onConnect={onWalletConnected}
        onDisconnect={handleDisconnect}
      />
      
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Dashboard Overview */}
        <DashboardStats entries={entries} payments={payments} />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Réseau</p>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                    <Badge variant="outline" className="text-success border-success/20">
                      Hedera Testnet
                    </Badge>
                  </div>
                </div>
                <Wallet className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Dernière transaction</p>
                  <p className="text-sm text-foreground">
                    {entries.length > 0 || payments.length > 0 
                      ? "Il y a quelques instants" 
                      : "Aucune transaction"}
                  </p>
                </div>
                <Hash className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Export disponible</p>
                  <Badge variant="outline" className="text-primary border-primary/20">
                    JSON • PDF
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData} className="hover:bg-primary hover:text-primary-foreground">
                  <Download className="h-4 w-4 mr-1" />
                  Exporter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="dashboard" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 bg-card border">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="journal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4 mr-2" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-2" />
              Paiements
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileBarChart className="h-4 w-4 mr-2" />
              Rapports
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-6">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>Vue d'ensemble</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Consultez vos statistiques et l'activité récente de votre comptabilité blockchain.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Toutes les opérations sont enregistrées de manière permanente sur Hedera Testnet.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="journal" className="space-y-6">
            <JournalEntry onEntryAdded={handleEntryAdded} />
            <EntriesHistory entries={entries} />
          </TabsContent>
          
          <TabsContent value="payments" className="space-y-6">
            <PaymentForm onPaymentAdded={handlePaymentAdded} />
            {payments.length > 0 && (
              <Card className="card-modern">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Historique des paiements ({payments.length})</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const { generatePaymentProofPDF } = await import("@/lib/pdf-generator");
                          for (const payment of payments) {
                            await generatePaymentProofPDF(payment);
                          }
                          toast({
                            title: "Justificatifs générés",
                            description: `${payments.length} PDFs téléchargés`,
                          });
                        } catch (error) {
                          toast({
                            title: "Erreur",
                            description: "Impossible de générer les justificatifs",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Tous les PDFs
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payments.map((payment) => (
                    <Card key={payment.id} className="border border-border/50 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <h4 className="font-medium text-foreground">{payment.objet}</h4>
                            <p className="text-sm text-muted-foreground">
                              {payment.type === 'paiement' ? 'Paiement vers' : 'Encaissement de'}: 
                              <span className="font-mono ml-1">{payment.destinataire.slice(0, 12)}...</span>
                            </p>
                            <div className="flex items-center space-x-2">
                              <Hash className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={`https://hashscan.io/testnet/transaction/${payment.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline"
                              >
                                {payment.txHash}
                              </a>
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <p className="font-semibold text-lg text-foreground">
                              {payment.montant} {payment.devise}
                            </p>
                            <Badge variant="default" className="bg-success/10 text-success border-success/20">
                              Confirmé
                            </Badge>
                            <div className="flex space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { generatePaymentProofPDF } = await import("@/lib/pdf-generator");
                                    await generatePaymentProofPDF(payment);
                                    toast({
                                      title: "Justificatif généré",
                                      description: "PDF téléchargé avec succès",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Erreur",
                                      description: "Impossible de générer le justificatif",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                PDF
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-6">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileBarChart className="h-5 w-5 text-primary" />
                  <span>Rapports et exports</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={handleExportData}
                    className="h-20 flex-col space-y-2 bg-gradient-primary hover:opacity-90"
                  >
                    <Download className="h-6 w-6" />
                    <span>Export complet (JSON + PDF)</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const allData = [...entries, ...payments];
                        if (allData.length === 0) {
                          toast({
                            title: "Aucune donnée",
                            description: "Aucune transaction à exporter",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        const csvContent = [
                          "Type,Date,Montant,Devise,Description,Hash",
                          ...entries.map(e => `Ecriture,${e.date},${e.montant},${e.devise},"${e.libelle}",${e.txHash}`),
                          ...payments.map(p => `${p.type},${new Date(p.timestamp).toISOString().split('T')[0]},${p.montant},${p.devise},"${p.objet}",${p.txHash}`)
                        ].join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `comptara_export_${new Date().toISOString().split('T')[0]}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Export CSV généré",
                          description: "Fichier CSV téléchargé avec succès",
                        });
                      } catch (error) {
                        toast({
                          title: "Erreur d'export",
                          description: "Impossible de générer l'export CSV",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="h-20 flex-col space-y-2"
                  >
                    <FileBarChart className="h-6 w-6" />
                    <span>Export CSV</span>
                  </Button>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">Informations d'export</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• JSON: Format structuré avec métadonnées complètes</li>
                    <li>• PDF: Rapport visuel avec QR codes pour vérification</li>
                    <li>• CSV: Compatible avec Excel et logiciels comptables</li>
                    <li>• Tous les exports incluent les hash de transaction blockchain</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;