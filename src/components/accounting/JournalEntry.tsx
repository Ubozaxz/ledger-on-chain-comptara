import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Hash, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { isMobile, getEthereum } from "@/lib/hedera";

interface JournalEntryProps {
  onEntryAdded: (entry: any) => void;
}

export const JournalEntry = ({ onEntryAdded }: JournalEntryProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    libelle: "",
    montant: "",
    devise: "HBAR",
    compteDebit: "",
    compteCredit: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.libelle || !formData.montant || !formData.compteDebit || !formData.compteCredit) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    // Check if wallet is connected
    const ethereum = getEthereum();
    if (!ethereum) {
      toast({
        title: "Wallet non connecté",
        description: "Connectez votre wallet pour ancrer l'écriture sur la blockchain",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { anchorEntryData, getExplorerTxUrl } = await import("@/lib/hedera");
      const payload = {
        type: "journal_entry",
        ...formData,
        timestamp: new Date().toISOString(),
      };
      const txHash = await anchorEntryData(payload);

      const entry = {
        date: formData.date,
        libelle: formData.libelle,
        montant: formData.montant,
        devise: formData.devise,
        debit: formData.compteDebit,
        credit: formData.compteCredit,
        txHash,
        description: formData.libelle,
      };

      onEntryAdded(entry);

      toast({
        title: "Écriture enregistrée avec succès",
        description: (
          <div className="space-y-2">
            <p>Montant: {formData.montant} {formData.devise}</p>
            <div className="flex items-center space-x-2">
              <Hash className="h-4 w-4" />
              <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:underline">
                {txHash.slice(0, 16)}...
              </a>
            </div>
          </div>
        ),
      });

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        libelle: "",
        montant: "",
        devise: "HBAR",
        compteDebit: "",
        compteCredit: "",
      });
    } catch (err: any) {
      console.error("JournalEntry error:", err);
      toast({
        title: "Échec de l'enregistrement",
        description: err?.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>{t('journalEntry')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t('date')} *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devise">{t('currency')}</Label>
              <Select value={formData.devise} onValueChange={(value) => setFormData({ ...formData, devise: value })}>
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
            <Label htmlFor="libelle">{t('description')} *</Label>
            <Textarea
              id="libelle"
              placeholder="Description de l'opération comptable..."
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant">{t('amount')} *</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.montant}
              onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="compteDebit">{t('debitAccount')} *</Label>
              <Input
                id="compteDebit"
                placeholder="Ex: 411000 - Clients"
                value={formData.compteDebit}
                onChange={(e) => setFormData({ ...formData, compteDebit: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compteCredit">{t('creditAccount')} *</Label>
              <Input
                id="compteCredit"
                placeholder="Ex: 701000 - Ventes"
                value={formData.compteCredit}
                onChange={(e) => setFormData({ ...formData, compteCredit: e.target.value })}
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary-hover"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};