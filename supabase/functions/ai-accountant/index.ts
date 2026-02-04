import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Tu es l'Agent IA avancé de Comptara, une plateforme de comptabilité blockchain sur Hedera. Tu es un expert-comptable et auditeur Web3 avec une expertise approfondie.

## IDENTITÉ
- Nom: Assistant Comptara
- Spécialisation: Comptabilité blockchain, audit on-chain, analyse financière Web3
- Réseau: Hedera Testnet (HBAR)

## CAPACITÉS

### 1. Assistant Comptable Intelligent
- Réponds aux questions sur la comptabilité en partie double
- Explique les concepts blockchain (hash, transactions, smart contracts)
- Guide l'utilisateur dans ses écritures comptables
- Fournis des conseils fiscaux adaptés aux crypto-actifs

### 2. Audit On-Chain
Quand tu reçois des données de ledger:
- Analyse les transactions pour détecter les anomalies
- Vérifie l'équilibre débit/crédit
- Identifie les doubles saisies potentielles
- Évalue les risques de rupture de trésorerie
- Calcule le score de santé financière (0-100%)
- Propose des optimisations concrètes

### 3. Analyse de Fichiers
- Analyse Excel, CSV, PDF pour extraire des données financières
- Calcule les ratios: solvabilité, liquidité, burn-rate
- Compare avec les standards du secteur
- Propose des optimisations fiscales

### 4. Voice-to-Entry
Quand tu reçois une transcription vocale, extrais en JSON:
{
  "montant": number,
  "devise": "HBAR" | "EUR" | "USD",
  "categorie": string,
  "tiers": string,
  "description": string,
  "type": "debit" | "credit",
  "txHash": string | null
}

## RÈGLES DE RÉPONSE
1. Sois concis mais technique
2. Utilise des émojis pertinents (📊 💰 ⚠️ ✅)
3. Structure avec des listes et des headers markdown
4. Pour les audits, commence par un résumé puis détaille
5. Fournis toujours des recommandations actionnables
6. Si les données sont insuffisantes, demande plus d'informations
7. Mentionne toujours le réseau Hedera quand pertinent

## FORMAT DE SORTIE AUDIT
\`\`\`
## 📊 Résumé de l'Audit

### Score de Santé: XX%
[Barre de progression visuelle]

### 🔍 Anomalies Détectées
- ...

### ✅ Points Positifs
- ...

### ⚠️ Recommandations
1. ...
2. ...
\`\`\``;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, prompt, ledgerData, transcription, fileData, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const messages: Array<{role: string, content: string}> = [
      { role: "system", content: SYSTEM_PROMPT }
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    let userMessage = "";

    switch (action) {
      case "voice-to-entry":
        userMessage = `Analyse cette transcription vocale et extrais les données comptables.

Transcription: "${transcription}"

Retourne UNIQUEMENT un JSON valide avec ce format exact:
{
  "montant": <nombre>,
  "devise": "<HBAR|EUR|USD>",
  "categorie": "<catégorie>",
  "tiers": "<tiers/fournisseur>",
  "description": "<description>",
  "type": "<debit|credit>",
  "txHash": null
}

Si tu ne peux pas extraire certaines informations, utilise null pour ces champs.`;
        break;

      case "audit":
        const summary = ledgerData?.summary || {};
        userMessage = `## Données du Ledger à Auditer

### Résumé
- Total écritures: ${summary.totalEntries || 0}
- Total paiements: ${summary.totalPayments || 0}
- Volume débits: ${summary.totalDebits?.toFixed(2) || 0} HBAR
- Volume paiements: ${summary.totalPaymentAmount?.toFixed(2) || 0} HBAR

### Écritures Comptables
${JSON.stringify(ledgerData?.entries || [], null, 2)}

### Paiements
${JSON.stringify(ledgerData?.payments || [], null, 2)}

---

Effectue un audit complet:
1. Vérifie l'équilibre débit/crédit
2. Détecte les anomalies (doubles saisies, incohérences)
3. Évalue la santé financière (score 0-100%)
4. Identifie les risques de trésorerie
5. Propose des optimisations concrètes

Utilise le format markdown structuré avec émojis.`;
        break;

      case "analyze-file":
        userMessage = `## Données Financières à Analyser

${JSON.stringify(fileData, null, 2)}

---

${prompt || "Effectue une analyse financière complète: ratios de solvabilité, liquidité, burn-rate, et propose des optimisations fiscales."}

Structure ta réponse avec des sections claires et des émojis.`;
        break;

      case "chat":
      default:
        userMessage = prompt || "Bonjour! Comment puis-je t'aider avec ta comptabilité blockchain?";
        
        if (ledgerData && (ledgerData.entries?.length > 0 || ledgerData.payments?.length > 0)) {
          userMessage += `\n\n---\n## Contexte: Données du Ledger Actuel
- ${ledgerData.entries?.length || 0} écritures comptables
- ${ledgerData.payments?.length || 0} paiements
- Volume total: ${((ledgerData.entries?.reduce((s: number, e: any) => s + (parseFloat(e.montant) || 0), 0) || 0) + 
                   (ledgerData.payments?.reduce((s: number, p: any) => s + (parseFloat(p.montant) || 0), 0) || 0)).toFixed(2)} HBAR`;
        }
        break;
    }

    messages.push({ role: "user", content: userMessage });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "Crédits IA insuffisants. Veuillez recharger votre compte." 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Accountant error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
