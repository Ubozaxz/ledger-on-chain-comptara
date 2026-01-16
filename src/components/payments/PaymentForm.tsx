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
    devise: "HBAR",
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

      // Only execute on-chain if user opted in AND wallet is available
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
        description: `${paymentData.montant} ${paymentData.devise} - ${txHash ? 'Exécuté on-chain' : 'Sauvegardé en cloud'}`,
      });

      // Reset form
      setPaymentData({
        type: "paiement",
        destinataire: "",
        montant: "",
        devise: "HBAR",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <span>{t('paymentForm')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transactionType')}</Label>
            <Select 
              value={paymentData.type} 
              onValueChange={(value) => setPaymentData({ ...paymentData, type: value })}
            >
              <SelectTrigger>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destinataire">{t('recipient')} *</Label>
              <Input
                id="destinataire"
                placeholder={executeOnChain ? "0x742d35Cc..." : "Nom ou adresse"}
                value={paymentData.destinataire}
                onChange={(e) => setPaymentData({ ...paymentData, destinataire: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devise">{t('currency')}</Label>
              <Select 
                value={paymentData.devise} 
                onValueChange={(value) => setPaymentData({ ...paymentData, devise: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HBAR">HBAR</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant">{t('amount')} *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={paymentData.montant}
              onChange={(e) => setPaymentData({ ...paymentData, montant: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objet">{t('object')} *</Label>
            <Textarea
              id="objet"
              placeholder="Décrivez l'objet du paiement..."
              value={paymentData.objet}
              onChange={(e) => setPaymentData({ ...paymentData, objet: e.target.value })}
              required
            />
          </div>

          {/* Blockchain execution toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Exécuter sur blockchain</p>
                <p className="text-xs text-muted-foreground">
                  {hasWallet 
                    ? "Envoyer réellement des HBAR via votre wallet" 
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
            className="w-full bg-primary hover:bg-primary-hover"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {executeOnChain ? "Transaction en cours..." : "Enregistrement..."}
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
