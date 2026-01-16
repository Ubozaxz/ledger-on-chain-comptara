import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es l'Agent IA natif de Comptara. Ton rôle est d'agir comme un expert-comptable et auditeur Web3.

CAPACITÉS:
1. Voice-to-Text: Analyse les transcriptions audio pour en extraire des données structurées (JSON) incluant: montant, devise, catégorie, tiers, et hash de transaction si mentionné.

2. Audit Réel: Tu as accès aux données du ledger on-chain. Ton but est de détecter des anomalies, des erreurs de double saisie ou des ruptures de trésorerie. Base tes réponses uniquement sur les données JSON/Excel fournies.

3. Analyse Excel: Reçois des fichiers structurés, calcule les ratios de solvabilité et propose des optimisations fiscales ou de burn-rate.

RÈGLES:
- Réponds toujours de manière concise et technique.
- Fournis des analyses basées sur des données réelles, pas de simulations.
- Pour les écritures comptables, retourne un JSON structuré quand demandé.
- Détecte les anomalies: double saisie, rupture de trésorerie, incohérences.
- Pour l'analyse financière, calcule: ratio de solvabilité, burn-rate, optimisations fiscales.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, prompt, ledgerData, transcription, fileData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let userMessage = "";

    switch (action) {
      case "voice-to-entry":
        userMessage = `Analyse cette transcription vocale et extrais les données comptables en JSON:
        Transcription: "${transcription}"
        
        Retourne un JSON avec: { montant, devise, categorie, tiers, description, type: "debit" | "credit", txHash (si mentionné) }`;
        break;

      case "audit":
        userMessage = `Effectue un audit complet de ce ledger on-chain:
        ${JSON.stringify(ledgerData, null, 2)}
        
        Analyse:
        1. Détecte les anomalies (double saisie, incohérences)
        2. Évalue la santé financière
        3. Identifie les ruptures de trésorerie potentielles
        4. Propose des optimisations`;
        break;

      case "analyze-file":
        userMessage = `Analyse ces données financières:
        ${JSON.stringify(fileData, null, 2)}
        
        ${prompt || "Calcule les ratios de solvabilité et propose des optimisations fiscales."}`;
        break;

      case "chat":
      default:
        userMessage = prompt || "Bonjour, comment puis-je vous aider?";
        if (ledgerData) {
          userMessage += `\n\nContexte - Données du ledger:\n${JSON.stringify(ledgerData, null, 2)}`;
        }
        break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
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
