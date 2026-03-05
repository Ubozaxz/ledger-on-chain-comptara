import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CreditCard, Hash, ArrowUpRight, ArrowDownLeft, Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getEthereum } from "@/lib/hedera";

interface PaymentFormProps {
  onPaymentAdded: (payment: any) => void;
}

export const PaymentForm = ({ onPaymentAdded }: PaymentFormProps) => {
  const { t } = useTranslation();
  const [paymentData, setPaymentData] = useState({
    type: "paiement",
    destinataire: "",
    montant: "",
    devise: "XOF",
    objet: "",
  });
  const [executeOnChain, setExecuteOnChain] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const hasWallet = !!getEthereum();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.destinataire || !paymentData.montant || !paymentData.objet) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      let txHash = "";

      if (executeOnChain && hasWallet) {
        const { sendHBAR, getExplorerTxUrl } = await import("@/lib/hedera");
        txHash = await sendHBAR({ to: paymentData.destinataire, amountHBAR: paymentData.montant });

        toast({
          title: "Transaction blockchain réussie",
          description: (
            <div className="flex items-center space-x-2">
              <Hash className="h-4 w-4" />
              <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                {txHash.slice(0, 16)}...
              </a>
            </div>
          ),
        });
      }

      const payment = {
        type: paymentData.type,
        destinataire: paymentData.destinataire,
        montant: paymentData.montant,
        devise: paymentData.devise,
        objet: paymentData.objet,
        txHash,
      };

      onPaymentAdded(payment);

      toast({
        title: `${paymentData.type === 'paiement' ? 'Paiement' : 'Encaissement'} enregistré`,
        description: `${paymentData.montant} ${paymentData.devise} - ${txHash ? 'On-chain' : 'Cloud'}`,
      });

      setPaymentData({
        type: "paiement",
        destinataire: "",
        montant: "",
        devise: "XOF",
        objet: "",
      });
    } catch (err: any) {
      console.error("PaymentForm error:", err);
      toast({
        title: "Échec de la transaction",
        description: err?.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="card-modern">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
          <CreditCard className="h-5 w-5 text-primary" />
          <span>{t('paymentForm')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-6 pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">{t('transactionType')}</Label>
            <Select 
              value={paymentData.type} 
              onValueChange={(value) => setPaymentData({ ...paymentData, type: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paiement">
                  <div className="flex items-center space-x-2">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>{t('payment')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="encaissement">
                  <div className="flex items-center space-x-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>{t('receipt')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="destinataire" className="text-sm">{t('recipient')} *</Label>
              <Input
                id="destinataire"
                placeholder={executeOnChain ? "0x742d35Cc..." : "Nom ou adresse"}
                value={paymentData.destinataire}
                onChange={(e) => setPaymentData({ ...paymentData, destinataire: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devise" className="text-sm">{t('currency')}</Label>
              <Select 
                value={paymentData.devise} 
                onValueChange={(value) => setPaymentData({ ...paymentData, devise: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="HBAR">HBAR</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant" className="text-sm">{t('amount')} *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={paymentData.montant}
              onChange={(e) => setPaymentData({ ...paymentData, montant: e.target.value })}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objet" className="text-sm">{t('object')} *</Label>
            <Textarea
              id="objet"
              placeholder="Décrivez l'objet du paiement..."
              value={paymentData.objet}
              onChange={(e) => setPaymentData({ ...paymentData, objet: e.target.value })}
              className="min-h-[80px] resize-none"
              required
            />
          </div>

          {/* Blockchain execution toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Exécuter sur blockchain</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {hasWallet 
                    ? "Envoyer réellement via votre wallet" 
                    : "Connectez un wallet EVM pour activer"}
                </p>
              </div>
            </div>
            <Switch
              checked={executeOnChain}
              onCheckedChange={setExecuteOnChain}
              disabled={!hasWallet}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:opacity-90 h-12 text-base touch-manipulation"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {executeOnChain ? "Transaction..." : "Enregistrement..."}
              </>
            ) : (
              paymentData.type === 'paiement' ? "Enregistrer le paiement" : "Confirmer l'encaissement"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
