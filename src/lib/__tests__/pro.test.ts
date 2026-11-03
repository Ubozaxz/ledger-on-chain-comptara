// @ts-nocheck
import { expect, test } from "bun:test";
import { PRO_PRICES, isProActive, planExpiry, buildWhatsAppLink } from "../pro";

test("prix Pro: 9900 FCFA/mois et 99000 FCFA/an", () => {
  expect(PRO_PRICES.monthly).toBe(9900);
  expect(PRO_PRICES.yearly).toBe(99000);
});
test("abonnement expiré = non Pro", () => {
  expect(isProActive("2020-01-01T00:00:00Z", new Date("2026-01-01"))).toBe(false);
  expect(isProActive(null)).toBe(false);
});
test("annuel = +1 an", () => {
  expect(planExpiry("yearly", new Date("2026-01-15T00:00:00Z")).getUTCFullYear()).toBe(2027);
});
test("lien WhatsApp vers +2250709633123", () => {
  expect(buildWhatsAppLink("monthly", "a@b.c")).toStartWith("https://wa.me/2250709633123?text=");
});
