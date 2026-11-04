export const WHATSAPP_NUMBER = "2250709633123";
export const PRO_PRICES = { monthly: 9900, yearly: 99900 } as const;
export type ProPlan = keyof typeof PRO_PRICES;

export function isProActive(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > now.getTime();
}

export function planExpiry(plan: ProPlan, from: Date = new Date()): Date {
  const d = new Date(from);
  if (plan === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function buildWhatsAppLink(plan: ProPlan, email?: string | null): string {
  const label = plan === "yearly" ? "annuel (99 900 FCFA/an)" : "mensuel (9 900 FCFA/mois)";
  const msg = `Bonjour Comptara, je souhaite activer l'abonnement Pro ${label}. Mon compte : ${email || "—"}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
