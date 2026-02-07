import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Hash, Link2, Loader2, Calculator, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getEthereum } from "@/lib/hedera";
import { supabase } from "@/integrations/supabase/client";

interface JournalEntryProps {
  onEntryAdded: (entry: any) => void;
}

interface TvaRate {
  id: string;
  code: string;
  label: string;
  rate: number;
  is_default: boolean;
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
    tvaRate: "",
    montantHT: "",
    montantTVA: "",
  });
  const [tvaRates, setTvaRates] = useState<TvaRate[]>([]);
  const [useTVA, setUseTVA] = useState(false);
  const [anchorOnChain, setAnchorOnChain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const hasWallet = !!getEthereum();

  // Fetch TVA rates
  useEffect(() => {
    const fetchTvaRates = async () => {
      const { data, error } = await supabase
        .from('tva_rates')
        .select('*')
        .order('rate', { ascending: false });
      
      if (!error && data) {
        setTvaRates(data);
        const defaultRate = data.find(r => r.is_default);
        if (defaultRate) {
          setFormData(prev => ({ ...prev, tvaRate: defaultRate.code }));
        }
      }
    };
    fetchTvaRates();
  }, []);

  // Calculate TVA amounts
  useEffect(() => {
    if (useTVA && formData.montantHT && formData.tvaRate) {
      const selectedRate = tvaRates.find(r => r.code === formData.tvaRate);
      if (selectedRate) {
        const ht = parseFloat(formData.montantHT) || 0;
        const tva = ht * (selectedRate.rate / 100);
        const ttc = ht + tva;
        setFormData(prev => ({
          ...prev,
          montantTVA: tva.toFixed(2),
          montant: ttc.toFixed(2)
        }));
      }
    }
  }, [formData.montantHT, formData.tvaRate, useTVA, tvaRates]);

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

    setIsSubmitting(true);

    try {
      let txHash = "";

      // Only anchor on-chain if user opted in AND wallet is available
      if (anchorOnChain && hasWallet) {
        const { anchorEntryData, getExplorerTxUrl } = await import("@/lib/hedera");
        const payload = {
          type: "journal_entry",
          ...formData,
          timestamp: new Date().toISOString(),
        };
        txHash = await anchorEntryData(payload);

        toast({
          title: "Ancré sur blockchain",
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

      const selectedRate = tvaRates.find(r => r.code === formData.tvaRate);
      
      const entry = {
        date: formData.date,
        libelle: formData.libelle,
        montant: formData.montant,
        devise: formData.devise,
        debit: formData.compteDebit,
        credit: formData.compteCredit,
        txHash,
        description: formData.libelle,
        tva_rate: useTVA && selectedRate ? selectedRate.rate : null,
        montant_ht: useTVA ? parseFloat(formData.montantHT) || null : null,
        montant_tva: useTVA ? parseFloat(formData.montantTVA) || null : null,
      };

      onEntryAdded(entry);

      toast({
        title: "Écriture enregistrée",
        description: `${formData.montant} ${formData.devise}${useTVA ? ` (HT: ${formData.montantHT})` : ''} - ${txHash ? 'Ancrée on-chain' : 'Sauvegardée en cloud'}`,
      });

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        libelle: "",
        montant: "",
        devise: "HBAR",
        compteDebit: "",
        compteCredit: "",
        tvaRate: tvaRates.find(r => r.is_default)?.code || "",
        montantHT: "",
        montantTVA: "",
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
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>{t('journalEntry')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm">{t('date')} *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devise" className="text-sm">{t('currency')}</Label>
              <Select value={formData.devise} onValueChange={(value) => setFormData({ ...formData, devise: value })}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HBAR">HBAR</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="libelle" className="text-sm">{t('description')} *</Label>
            <Textarea
              id="libelle"
              placeholder="Description de l'opération comptable..."
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
              className="min-h-[80px] resize-none"
              required
            />
          </div>

          {/* TVA Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Percent className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Calcul TVA</p>
                <p className="text-xs text-muted-foreground">Activer le calcul automatique de la TVA</p>
              </div>
            </div>
            <Switch
              checked={useTVA}
              onCheckedChange={setUseTVA}
            />
          </div>

          {useTVA ? (
            <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tvaRate" className="text-sm">Taux TVA</Label>
                  <Select value={formData.tvaRate} onValueChange={(value) => setFormData({ ...formData, tvaRate: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {tvaRates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.code}>
                          {rate.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="montantHT" className="text-sm">Montant HT *</Label>
                  <Input
                    id="montantHT"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.montantHT}
                    onChange={(e) => setFormData({ ...formData, montantHT: e.target.value })}
                    className="h-11"
                    required={useTVA}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">TVA</p>
                  <p className="text-lg font-bold text-primary">{formData.montantTVA || "0.00"} {formData.devise}</p>
                </div>
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">TTC</p>
                  <p className="text-lg font-bold text-success">{formData.montant || "0.00"} {formData.devise}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="montant" className="text-sm">{t('amount')} *</Label>
              <Input
                id="montant"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                className="h-11"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="compteDebit" className="text-sm">{t('debitAccount')} *</Label>
              <Input
                id="compteDebit"
                placeholder="Ex: 411000 - Clients"
                value={formData.compteDebit}
                onChange={(e) => setFormData({ ...formData, compteDebit: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compteCredit" className="text-sm">{t('creditAccount')} *</Label>
              <Input
                id="compteCredit"
                placeholder="Ex: 701000 - Ventes"
                value={formData.compteCredit}
                onChange={(e) => setFormData({ ...formData, compteCredit: e.target.value })}
                className="h-11"
                required
              />
            </div>
          </div>

          {/* Blockchain anchor toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Ancrer sur blockchain</p>
                <p className="text-xs text-muted-foreground">
                  {hasWallet 
                    ? "Signer avec votre wallet pour preuve immuable" 
                    : "Connectez un wallet EVM pour activer"}
                </p>
              </div>
            </div>
            <Switch
              checked={anchorOnChain}
              onCheckedChange={setAnchorOnChain}
              disabled={!hasWallet}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:opacity-90 h-12 text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {anchorOnChain ? "Signature en cours..." : "Enregistrement..."}
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                {t('submit')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};