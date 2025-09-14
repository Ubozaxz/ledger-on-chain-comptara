import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { JournalEntry } from "@/components/accounting/JournalEntry";
import { EntriesHistory } from "@/components/accounting/EntriesHistory";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, CreditCard, FileBarChart, Download, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      const { ensureHederaTestnet, connectWallet } = await import("@/lib/hedera");
      await ensureHederaTestnet();
      const account = await connectWallet();
      setIsConnected(true);
      setWalletAddress(account);
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
    toast({ title: "Déconnecté", description: "Portefeuille déconnecté" });
  };

  const handleEntryAdded = (entry: any) => {
    setEntries(prev => [entry, ...prev]);
  };

  const handlePaymentAdded = (payment: any) => {
    setPayments(prev => [payment, ...prev]);
  };

  const handleExportData = () => {
    const exportData = {
      entries,
      payments,
      exportDate: new Date().toISOString(),
      walletAddress
    };
    
    toast({
      title: "Export généré",
      description: "Données comptables exportées avec succès",
    });
    
    // Simulation du téléchargement
    console.log("Export data:", exportData);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          isConnected={isConnected}
          walletAddress={walletAddress}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-warning" />
              </div>
              <CardTitle>Connexion requise</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Connectez votre portefeuille Metamask pour accéder à comptara et commencer à enregistrer vos écritures comptables sur Hedera Testnet.
              </p>
              <Button 
                onClick={handleConnect} 
                className="w-full bg-primary hover:bg-primary-hover"
              >
                Connecter Metamask
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isConnected={isConnected}
        walletAddress={walletAddress}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Dashboard Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{entries.length}</p>
                  <p className="text-sm text-muted-foreground">Écritures comptables</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{payments.length}</p>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileBarChart className="h-8 w-8 text-audit-purple" />
                  <div>
                    <p className="text-sm text-muted-foreground">Export disponible</p>
                    <Badge variant="outline" className="mt-1">JSON/PDF</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-1" />
                  Exporter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="journal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="journal">Journal comptable</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
          </TabsList>
          
          <TabsContent value="journal" className="space-y-6">
            <JournalEntry onEntryAdded={handleEntryAdded} />
            <EntriesHistory entries={entries} />
          </TabsContent>
          
          <TabsContent value="payments" className="space-y-6">
            <PaymentForm onPaymentAdded={handlePaymentAdded} />
            {payments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Historique des paiements ({payments.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payments.map((payment) => (
                    <Card key={payment.id} className="border border-border/50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{payment.objet}</h4>
                            <p className="text-sm text-muted-foreground">
                              {payment.type === 'paiement' ? 'Paiement vers' : 'Encaissement de'}: {payment.destinataire.slice(0, 12)}...
                            </p>
                            <p className="text-xs font-mono text-muted-foreground mt-1">
                              {payment.txHash}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">
                              {payment.montant} {payment.devise}
                            </p>
                            <Badge variant="default">Confirmé</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
