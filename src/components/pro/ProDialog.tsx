import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, MessageCircle } from "lucide-react";
import { buildWhatsAppLink, PRO_PRICES } from "@/lib/pro";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; email?: string | null; reason?: string; }

export const ProDialog = ({ open, onOpenChange, email, reason }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-5">
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" />Comptara Pro</DialogTitle>
        <DialogDescription>{reason || "Débloquez la certification blockchain et les exports avancés."}</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2 text-sm">
        {["Certification blockchain Hedera de vos écritures et dictées", "Export complet JSON + PDF certifié avec QR codes", "Export CSV pour Excel et logiciels comptables", "Support prioritaire sur WhatsApp"].map(f => (
          <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{f}</li>
        ))}
      </ul>
      <div className="grid gap-3">
        {(["monthly", "yearly"] as const).map(plan => (
          <a key={plan} href={buildWhatsAppLink(plan, email)} target="_blank" rel="noreferrer"
            className="block rounded-xl border border-border p-4 hover:border-primary transition-colors touch-manipulation">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{plan === "monthly" ? "Mensuel" : "Annuel"}</span>
              {plan === "yearly" && <Badge>2 mois offerts</Badge>}
            </div>
            <div className="text-xl font-bold mt-1">{PRO_PRICES[plan].toLocaleString("fr-FR")} FCFA<span className="text-sm font-normal text-muted-foreground">/{plan === "monthly" ? "mois" : "an"}</span></div>
            <Button asChild className="w-full mt-3 h-11"><span><MessageCircle className="h-4 w-4 mr-2" />Payer via WhatsApp</span></Button>
          </a>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Paiement par Wave, Orange Money ou MTN au +225 07 09 63 31 23. Envoyez la capture du reçu sur WhatsApp : votre compte Pro est activé dès validation.</p>
    </DialogContent>
  </Dialog>
);
