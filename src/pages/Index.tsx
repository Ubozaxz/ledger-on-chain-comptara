import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { WalletType } from "@/lib/wallets";
import { JournalEntry } from "@/components/accounting/JournalEntry";
import { EntriesHistory } from "@/components/accounting/EntriesHistory";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";
import { VoiceToEntry } from "@/components/ai/VoiceToEntry";
import { AuditModule } from "@/components/ai/AuditModule";
import { FileAnalyzer } from "@/components/ai/FileAnalyzer";
import { AIChat } from "@/components/ai/AIChat";
import { SmartSuggestions } from "@/components/ai/SmartSuggestions";
import { StatusBanner } from "@/components/ui/status-banner";
import { useCloudData } from "@/hooks/useCloudData";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, CreditCard, FileBarChart, Download, BarChart3, Wallet, Hash, Bot, RefreshCw, Cloud, Loader2, LogIn, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const tabsRef = useRef<HTMLDivElement>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const { toast } = useToast();
  
  // Use cloud data hook for persistence (requires auth)
  const { entries, payments, isLoading, isOnline, pendingSync, addEntry, addPayment, refreshData, syncOfflineQueue } = useCloudData(walletAddress, user?.id ?? null);

  const onWalletConnected = (address: string, type: WalletType) => {
    setIsConnected(true);
    setWalletAddress(address);
    setWalletType(type);
    toast({ title: 'Wallet connecté', description: `${type.toUpperCase()} - ${address.slice(0,8)}...` });
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleConnect = async () => {
    try {
      const { ensureHederaTestnet, connectWallet } = await import("@/lib/hedera");
      await ensureHederaTestnet();
      const account = await connectWallet();
      setIsConnected(true);
      setWalletAddress(account);
      setWalletType('metamask');
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

  const handleEntryAdded = async (entry: any) => {
    await addEntry({
      date: entry.date || new Date().toISOString().split('T')[0],
      libelle: entry.libelle || entry.description || 'Écriture comptable',
      debit: entry.debit || '',
      credit: entry.credit || '',
      montant: parseFloat(entry.montant) || 0,
      devise: entry.devise || 'HBAR',
      tx_hash: entry.txHash || '',
      description: entry.description,
      category: entry.category,
    });
    toast({ title: 'Écriture enregistrée', description: 'Sauvegardée dans le Cloud' });
  };

  const handlePaymentAdded = async (payment: any) => {
    await addPayment({
      type: payment.type || 'paiement',
      destinataire: payment.destinataire || '',
      montant: parseFloat(payment.montant) || 0,
      devise: payment.devise || 'HBAR',
      objet: payment.objet || '',
      tx_hash: payment.txHash || '',
      status: 'confirmed',
    });
    toast({ title: 'Transaction enregistrée', description: 'Sauvegardée dans le Cloud' });
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 pb-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 pb-16 px-4">
        <Card className="w-full max-w-md card-modern">
          <CardHeader className="text-center p-6">
            <CardTitle className="text-2xl text-gradient">Connexion requise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center p-6">
            <p className="text-sm text-muted-foreground">
              Connectez-vous avec votre email et mot de passe pour accéder à la plateforme.
            </p>
            <Button className="w-full bg-gradient-primary hover:opacity-90 h-12" onClick={() => navigate('/auth')}>
              <LogIn className="h-5 w-5 mr-2" />
              Aller à la connexion
            </Button>
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-16">
        <WalletConnector 
          isConnected={isConnected}
          walletAddress={walletAddress}
          walletType={walletType}
          onConnect={onWalletConnected}
          onDisconnect={handleDisconnect}
        />
        
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-4">
          <Card className="w-full max-w-md card-modern">
            <CardHeader className="text-center p-4 md:p-6">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 md:h-16 md:w-16 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Wallet className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl md:text-2xl text-gradient">Connexion requise</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 md:space-y-6 p-4 md:p-6">
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Connectez votre portefeuille pour accéder à <strong>Comptara</strong> et commencer à enregistrer vos écritures comptables sur Hedera Testnet.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-3 md:p-4 space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-success rounded-full"></div>
                  <span className="text-xs md:text-sm text-muted-foreground">Hedera Testnet</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-primary rounded-full"></div>
                  <span className="text-xs md:text-sm text-muted-foreground">Transactions sécurisées</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-2 w-2 bg-warning rounded-full"></div>
                  <span className="text-xs md:text-sm text-muted-foreground">Persistance Cloud</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Button 
                  onClick={handleConnect} 
                  className="flex-1 bg-gradient-primary hover:opacity-90 transition-all duration-300 glow touch-manipulation h-11 md:h-12 text-sm md:text-base"
                >
                  <Wallet className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                  Connecter Wallet
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-20">
      <WalletConnector 
        isConnected={isConnected}
        walletAddress={walletAddress}
        walletType={walletType}
        onConnect={onWalletConnected}
        onDisconnect={handleDisconnect}
      />
      
      <div className="container mx-auto px-2 sm:px-4 py-3 md:py-8 space-y-3 md:space-y-8 max-w-7xl">
        {/* Status Banner */}
        <StatusBanner
          isAuthenticated={isAuthenticated}
          isOnline={isOnline}
          walletConnected={isConnected}
          walletType={walletType}
          pendingSync={pendingSync}
          onSyncClick={syncOfflineQueue}
        />

        {/* Cloud Status & Dashboard Overview */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className={`text-xs ${isOnline ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
              <Cloud className="h-3 w-3 mr-1" />
              {isOnline ? 'Cloud Sync Active' : 'Mode Hors-ligne'}
            </Badge>
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/admin')}
                className="h-7 px-2 text-xs bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Button>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshData}
            disabled={isLoading}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <DashboardStats entries={entries} payments={payments} />
        
        {/* Smart Suggestions */}
        <SmartSuggestions 
          entries={entries} 
          payments={payments}
          onSuggestionClick={(action) => {
            if (action === "navigate-journal" && tabsRef.current) {
              const journalTab = tabsRef.current.querySelector('[value="journal"]') as HTMLButtonElement;
              journalTab?.click();
            } else if (action === "navigate-ai" && tabsRef.current) {
              const aiTab = tabsRef.current.querySelector('[value="ai"]') as HTMLButtonElement;
              aiTab?.click();
            } else if (action === "export") {
              handleExportData();
            } else if (action === "run-audit" && tabsRef.current) {
              const dashboardTab = tabsRef.current.querySelector('[value="dashboard"]') as HTMLButtonElement;
              dashboardTab?.click();
            }
          }}
        />

        {/* Quick Actions - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
          <Card className="card-modern">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 md:space-y-2">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Réseau</p>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                    <Badge variant="outline" className="text-success border-success/20 text-xs">
                      Hedera Testnet
                    </Badge>
                  </div>
                </div>
                <Wallet className="h-6 w-6 md:h-8 md:w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 md:space-y-2">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Dernière transaction</p>
                  <p className="text-xs md:text-sm text-foreground">
                    {entries.length > 0 || payments.length > 0 
                      ? "Il y a quelques instants" 
                      : "Aucune transaction"}
                  </p>
                </div>
                <Hash className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 md:space-y-2">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Export disponible</p>
                  <Badge variant="outline" className="text-primary border-primary/20 text-xs">
                    JSON • PDF
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData} className="hover:bg-primary hover:text-primary-foreground h-8 px-2 md:px-3">
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Mobile First Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4 md:space-y-8">
          <TabsList ref={tabsRef} className="grid w-full grid-cols-5 bg-card border h-auto p-1 gap-0.5">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex flex-col items-center py-2 px-1 gap-0.5 min-h-[52px]">
              <BarChart3 className="h-4 w-4" />
              <span className="text-[10px] leading-tight">Board</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex flex-col items-center py-2 px-1 gap-0.5 min-h-[52px]">
              <BookOpen className="h-4 w-4" />
              <span className="text-[10px] leading-tight">Journal</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex flex-col items-center py-2 px-1 gap-0.5 min-h-[52px]">
              <CreditCard className="h-4 w-4" />
              <span className="text-[10px] leading-tight">Paiement</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex flex-col items-center py-2 px-1 gap-0.5 min-h-[52px]">
              <Bot className="h-4 w-4" />
              <span className="text-[10px] leading-tight">IA</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex flex-col items-center py-2 px-1 gap-0.5 min-h-[52px]">
              <FileBarChart className="h-4 w-4" />
              <span className="text-[10px] leading-tight">Rapports</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="space-y-4 md:space-y-6">
            <AnalyticsCharts entries={entries} payments={payments} />
            <AuditModule entries={entries} payments={payments} />
            <AIChat ledgerData={{ entries, payments }} />
          </TabsContent>
          
          <TabsContent value="ai" className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <VoiceToEntry 
                onEntryExtracted={(entry) => {
                  // Auto-save if montant is present
                  if (entry.montant) {
                    handleEntryAdded({
                      date: new Date().toISOString().split('T')[0],
                      libelle: entry.description || 'Écriture vocale',
                      debit: entry.type === 'debit' ? entry.categorie || 'Divers' : '',
                      credit: entry.type === 'credit' ? entry.categorie || 'Divers' : '',
                      montant: entry.montant,
                      devise: entry.devise || 'HBAR',
                      txHash: entry.txHash || '',
                      description: entry.description,
                    });
                  }
                }}
                onInsertToJournal={(entry) => {
                  // Navigate to journal tab and show pre-filled data
                  toast({
                    title: "Données prêtes",
                    description: `${entry.montant} ${entry.devise || 'HBAR'} - Allez dans l'onglet Journal pour compléter`,
                  });
                  handleEntryAdded({
                    date: new Date().toISOString().split('T')[0],
                    libelle: entry.description || entry.categorie || 'Écriture vocale',
                    debit: entry.type === 'debit' ? entry.categorie || 'Divers' : '',
                    credit: entry.type === 'credit' ? entry.categorie || 'Divers' : '',
                    montant: entry.montant || 0,
                    devise: entry.devise || 'HBAR',
                    txHash: entry.txHash || '',
                    description: entry.description,
                  });
                }}
                onInsertToPayment={(entry) => {
                  // Save as payment
                  toast({
                    title: "Données prêtes",
                    description: `${entry.montant} ${entry.devise || 'HBAR'} - Paiement enregistré`,
                  });
                  handlePaymentAdded({
                    type: entry.type === 'credit' ? 'encaissement' : 'paiement',
                    destinataire: entry.tiers || 'Non spécifié',
                    montant: entry.montant || 0,
                    devise: entry.devise || 'HBAR',
                    objet: entry.description || entry.categorie || 'Opération vocale',
                    txHash: entry.txHash || '',
                  });
                }}
              />
              <FileAnalyzer />
            </div>
            <AIChat ledgerData={{ entries, payments }} />
          </TabsContent>
          
          <TabsContent value="journal" className="space-y-4 md:space-y-6">
            <JournalEntry onEntryAdded={handleEntryAdded} />
            <EntriesHistory entries={entries} />
          </TabsContent>
          
          <TabsContent value="payments" className="space-y-4 md:space-y-6">
            <PaymentForm onPaymentAdded={handlePaymentAdded} />
            {payments.length > 0 && (
              <Card className="card-modern">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="flex items-center justify-between text-base md:text-lg">
                    <span>Historique des paiements ({payments.length})</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
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
                      <Download className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                      <span className="hidden sm:inline">Tous les PDFs</span>
                      <span className="sm:hidden">PDFs</span>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6">
                  {payments.map((payment) => (
                    <Card key={payment.id} className="border border-border/50 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                          <div className="space-y-1 md:space-y-2 min-w-0 flex-1">
                            <h4 className="font-medium text-foreground text-sm md:text-base truncate">{payment.objet}</h4>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {payment.type === 'paiement' ? 'Paiement vers' : 'Encaissement de'}: 
                              <span className="font-mono ml-1">{payment.destinataire.slice(0, 12)}...</span>
                            </p>
                            <div className="flex items-center space-x-2">
                              <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <a
                                href={`https://hashscan.io/testnet/transaction/${payment.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline truncate"
                              >
                                {payment.tx_hash}
                              </a>
                            </div>
                          </div>
                          <div className="text-right space-y-1 md:space-y-2 flex-shrink-0">
                            <p className="font-semibold text-base md:text-lg text-foreground">
                              {payment.montant} {payment.devise}
                            </p>
                            <Badge variant="default" className="bg-success/10 text-success border-success/20 text-xs">
                              Confirmé
                            </Badge>
                            <div className="flex space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
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
          
          <TabsContent value="reports" className="space-y-4 md:space-y-6">
            <Card className="card-modern">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
                  <FileBarChart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <span>Rapports et exports</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <Button
                    onClick={handleExportData}
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2 bg-gradient-primary hover:opacity-90"
                  >
                    <Download className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">Export complet (JSON + PDF)</span>
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
                          ...entries.map(e => `Ecriture,${e.date},${e.montant},${e.devise},"${e.libelle}",${e.tx_hash}`),
                          ...payments.map(p => `${p.type},${new Date(p.created_at).toISOString().split('T')[0]},${p.montant},${p.devise},"${p.objet}",${p.tx_hash}`)
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
                    className="h-16 md:h-20 flex-col space-y-1 md:space-y-2"
                  >
                    <FileBarChart className="h-5 w-5 md:h-6 md:w-6" />
                    <span className="text-xs md:text-sm">Export CSV</span>
                  </Button>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3 md:p-4">
                  <h4 className="font-medium text-foreground mb-2 text-sm md:text-base">Informations d'export</h4>
                  <ul className="text-xs md:text-sm text-muted-foreground space-y-1">
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
