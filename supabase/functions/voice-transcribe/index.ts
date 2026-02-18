import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function authenticateRequest(req: Request): Promise<{ user: { id: string; email?: string } | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (token === anonKey) {
    return { user: null, error: 'Authentication required. Please sign in to use this feature.' };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return { user: null, error: 'Invalid or expired token' };
    }
    return { user: { id: data.user.id, email: data.user.email }, error: null };
  } catch (e) {
    return { user: null, error: 'Authentication failed' };
  }
}

function sanitizeInput(input: string): string {
  if (!input) return '';
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s{10,}/g, ' ').trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { transcript, audio } = body;

    // Mode 1: transcript already provided by client (Web Speech API)
    // Mode 2: audio base64 provided (fallback)
    let finalTranscript = transcript || "";

    if (!finalTranscript && !audio) {
      throw new Error("No transcript or audio data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Processing voice request for user: ${user.id}, transcript: "${finalTranscript}"`);

    // If we have a transcript, use AI to extract structured accounting data FROM THE REAL TEXT
    if (finalTranscript) {
      const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Tu es un assistant d'extraction de données comptables professionnelles pour Comptara, une plateforme de comptabilité blockchain.

MISSION: Extraire les données comptables structurées EXACTEMENT à partir du texte transcrit fourni. Ne génère RIEN de fictif - extrait uniquement ce qui est dit dans le texte.

TAUX DE TVA SUPPORTÉS:
- 20% (France - taux normal)
- 10% (France - taux intermédiaire)  
- 5.5% (France - taux réduit)
- 2.1% (France - presse/médicaments)
- 18% (Côte d'Ivoire - taux normal UEMOA)
- 0% (exonéré)

DEVISES: si non mentionnée, utilise EUR par défaut. Supporte: EUR, HBAR, USD, USDC, XOF (FCFA)

CATÉGORIES COMPTABLES:
- Achats/Fournisseurs, Ventes/Clients, Frais généraux
- Salaires/Charges sociales, Investissements, Trésorerie, Taxes/TVA

RÈGLES IMPORTANTES:
1. N'invente JAMAIS de montant ou d'information - extrait uniquement ce qui est explicitement dit
2. Si un montant est TTC avec TVA mentionnée, calcule le HT automatiquement
3. Si le type n'est pas clair, déduis-le du contexte (achat=débit, vente=crédit)
4. Pour XOF/FCFA, utilise la devise "XOF"

Retourne TOUJOURS ce JSON exact (sans markdown):
{
  "entry": {
    "montant": <nombre TTC ou total mentionné>,
    "devise": "EUR|HBAR|USD|USDC|XOF",
    "description": "<description claire extraite du texte>",
    "type": "debit|credit",
    "categorie": "<catégorie comptable>",
    "tiers": "<nom du fournisseur ou client si mentionné, sinon null>",
    "tvaRate": <nombre ou null>,
    "montantHT": <nombre ou null>,
    "montantTVA": <nombre ou null>
  }
}`
            },
            {
              role: "user",
              content: `Extrait les données comptables de cette transcription vocale réelle:

"${sanitizeInput(finalTranscript).slice(0, 1000)}"

Retourne uniquement le JSON structuré avec les données exactes du texte.`
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!extractionResponse.ok) {
        const errText = await extractionResponse.text();
        console.error("AI extraction error:", extractionResponse.status, errText);
        if (extractionResponse.status === 429) {
          return new Response(JSON.stringify({ 
            transcription: finalTranscript,
            error: "Limite de requêtes IA atteinte. La transcription est disponible mais l'extraction automatique a échoué." 
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Erreur d'extraction IA");
      }

      const aiResponse = await extractionResponse.json();
      const content = aiResponse.choices?.[0]?.message?.content || "";
      
      console.log("AI extraction response:", content);

      let entry: any = null;
      try {
        let cleanContent = content;
        if (content.includes("```json")) {
          cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
        } else if (content.includes("```")) {
          cleanContent = content.replace(/```\n?/g, "");
        }

        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const validDevises = ['HBAR', 'EUR', 'USD', 'USDC', 'XOF'];
          const validTypes = ['debit', 'credit'];
          const validTvaRates = [0, 2.1, 5.5, 10, 18, 20, null];

          if (parsed.entry && typeof parsed.entry === 'object') {
            entry = {
              montant: typeof parsed.entry.montant === 'number' ? Math.abs(parsed.entry.montant) : 0,
              devise: validDevises.includes(parsed.entry.devise) ? parsed.entry.devise : 'EUR',
              description: typeof parsed.entry.description === 'string' ? sanitizeInput(parsed.entry.description).slice(0, 200) : finalTranscript.slice(0, 100),
              type: validTypes.includes(parsed.entry.type) ? parsed.entry.type : 'debit',
              categorie: typeof parsed.entry.categorie === 'string' ? sanitizeInput(parsed.entry.categorie).slice(0, 50) : '',
              tiers: typeof parsed.entry.tiers === 'string' ? sanitizeInput(parsed.entry.tiers).slice(0, 100) : null,
              tvaRate: validTvaRates.includes(parsed.entry.tvaRate) ? parsed.entry.tvaRate : null,
              montantHT: typeof parsed.entry.montantHT === 'number' ? Math.abs(parsed.entry.montantHT) : null,
              montantTVA: typeof parsed.entry.montantTVA === 'number' ? Math.abs(parsed.entry.montantTVA) : null,
            };

            // Auto-calculate TVA if rate and amount present
            if (entry.tvaRate && entry.montant && !entry.montantHT) {
              entry.montantHT = parseFloat((entry.montant / (1 + entry.tvaRate / 100)).toFixed(2));
              entry.montantTVA = parseFloat((entry.montant - entry.montantHT).toFixed(2));
            }
          }
        }
      } catch (e) {
        console.log("Could not parse JSON from AI response");
      }

      const result = { transcription: finalTranscript, entry };
      console.log("Returning result:", result);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: no transcript available
    return new Response(JSON.stringify({ 
      transcription: "",
      error: "Aucune transcription disponible. Vérifiez les permissions microphone." 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("voice-transcribe error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur de transcription" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
