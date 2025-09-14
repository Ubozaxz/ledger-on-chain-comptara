import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Hash, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentFormProps {
  onPaymentAdded: (payment: any) => void;
}

export const PaymentForm = ({ onPaymentAdded }: PaymentFormProps) => {
  const [paymentData, setPaymentData] = useState({
    type: "paiement", // paiement ou encaissement
    destinataire: "",
    montant: "",
    devise: "HBAR",
    objet: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

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
      const { sendHBAR, getExplorerTxUrl } = await import("@/lib/hedera");
      const txHash = await sendHBAR({ to: paymentData.destinataire, amountHBAR: paymentData.montant });

      const payment = {
        id: Date.now().toString(),
        ...paymentData,
        txHash,
        timestamp: new Date().toISOString(),
        status: "success",
      };

      onPaymentAdded(payment);

      toast({
        title: `${paymentData.type === 'paiement' ? 'Paiement' : 'Encaissement'} effectué`,
        description: (
          <div className="space-y-2">
            <p>Montant: {paymentData.montant} {paymentData.devise}</p>
            <p>Destinataire: {paymentData.destinataire.slice(0, 8)}...</p>
            <div className="flex items-center space-x-2">
              <Hash className="h-4 w-4" />
              <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                {txHash}
              </a>
            </div>
          </div>
        ),
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
          <span>Paiements & Règlements</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type d'opération</Label>
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
                    <span>Paiement fournisseur</span>
                  </div>
                </SelectItem>
                <SelectItem value="encaissement">
                  <div className="flex items-center space-x-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>Encaissement client</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destinataire">Adresse destinataire *</Label>
              <Input
                id="destinataire"
                placeholder="0x742d35Cc..."
                value={paymentData.destinataire}
                onChange={(e) => setPaymentData({ ...paymentData, destinataire: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devise">Devise</Label>
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
            <Label htmlFor="montant">Montant *</Label>
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
            <Label htmlFor="objet">Objet du paiement *</Label>
            <Textarea
              id="objet"
              placeholder="Décrivez l'objet du paiement..."
              value={paymentData.objet}
              onChange={(e) => setPaymentData({ ...paymentData, objet: e.target.value })}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary-hover"
            disabled={isProcessing}
          >
            {isProcessing ? "Transaction en cours..." : 
              paymentData.type === 'paiement' ? "Effectuer le paiement" : "Confirmer l'encaissement"
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};