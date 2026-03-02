import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (token === anonKey) {
    return { user: null, error: 'Authentication required.' };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  try {
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) return { user: null, error: 'Invalid or expired token' };
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

    const body = await req.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 2) {
      return new Response(JSON.stringify({ 
        error: "Aucune transcription reçue. Parlez clairement dans le microphone." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow longer transcripts for extended recordings (up to 5 min)
    const finalTranscript = sanitizeInput(transcript).slice(0, 5000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Voice extraction for user ${user.id}: "${finalTranscript.slice(0, 100)}..."`);

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
            content: `Tu es un extracteur de données comptables expert pour l'Afrique de l'Ouest francophone et la France. Tu reçois une transcription vocale en français et tu dois extraire UNIQUEMENT les informations réellement présentes dans le texte.

RÈGLES ABSOLUES:
1. N'INVENTE RIEN. Si une information n'est pas dans le texte, mets null.
2. Extrais le montant EXACT tel que dicté. Ne modifie jamais le montant.
3. La description doit reprendre les mots exacts du texte, pas une reformulation.
4. Le tiers (fournisseur/client) doit être le nom exact mentionné.
5. Si aucun montant n'est clairement dit, retourne montant: null.
6. Si le texte est long, identifie CHAQUE opération distincte. Si plusieurs opérations, retourne celle avec le montant le plus élevé ET mentionne les autres dans la description.

RECONNAISSANCE DES MONTANTS:
- "soixante-quinze mille" = 75000
- "deux millions cinq cent" = 2500000
- "cent cinquante mille francs" = 150000
- "1,5 million" = 1500000
- Comprends les montants en lettres ET en chiffres
- "mille francs CFA" ou "mille FCFA" = 1000 XOF

DEVISES (par défaut XOF si contexte africain):
- XOF / FCFA / francs CFA / francs → "XOF"
- EUR / euros → "EUR"
- USD / dollars → "USD"
- HBAR → "HBAR"
- USDC → "USDC"
- Si aucune devise mentionnée et contexte UEMOA/Côte d'Ivoire → "XOF"
- Si aucune devise mentionnée et contexte France → "EUR"

TAUX TVA reconnus:
- 18% (Côte d'Ivoire/UEMOA - défaut si TVA mentionnée sans taux)
- 20%, 10%, 5.5%, 2.1% (France)
- 0% (exonéré)

CATÉGORIES: Achats/Fournisseurs, Ventes/Clients, Frais généraux, Salaires, Investissements, Trésorerie, Taxes/TVA, Loyer, Transport, Communication, Assurance

TYPE: achat/dépense/paiement/facture fournisseur = "debit", vente/encaissement/recette/facture client = "credit"

Si TVA mentionnée et montant TTC donné:
- montantHT = montant / (1 + tvaRate/100)
- montantTVA = montant - montantHT

Retourne UNIQUEMENT ce JSON (pas de markdown, pas de texte autour):
{"entry":{"montant":<number|null>,"devise":"XOF","description":"<texte exact>","type":"debit","categorie":"<catégorie>","tiers":<"nom"|null>,"tvaRate":<number|null>,"montantHT":<number|null>,"montantTVA":<number|null>}}`
          },
          {
            role: "user",
            content: `Transcription vocale à analyser:\n"${finalTranscript}"`
          }
        ],
        temperature: 0.05,
        max_tokens: 800,
      }),
    });

    if (!extractionResponse.ok) {
      const errText = await extractionResponse.text();
      console.error("AI extraction error:", extractionResponse.status, errText);
      if (extractionResponse.status === 429) {
        return new Response(JSON.stringify({ 
          transcription: finalTranscript,
          entry: null,
          error: "Limite IA atteinte. Transcription disponible mais extraction automatique échouée." 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erreur d'extraction IA");
    }

    const aiResponse = await extractionResponse.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI raw response:", content);

    let entry: any = null;
    try {
      let cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const raw = parsed.entry || parsed;
        
        if (raw && raw.montant !== null && raw.montant !== undefined && typeof raw.montant === 'number' && raw.montant > 0) {
          const validDevises = ['HBAR', 'EUR', 'USD', 'USDC', 'XOF'];
          const validTypes = ['debit', 'credit'];

          entry = {
            montant: Math.abs(raw.montant),
            devise: validDevises.includes(raw.devise) ? raw.devise : 'XOF',
            description: typeof raw.description === 'string' ? sanitizeInput(raw.description).slice(0, 500) : finalTranscript.slice(0, 200),
            type: validTypes.includes(raw.type) ? raw.type : 'debit',
            categorie: typeof raw.categorie === 'string' ? sanitizeInput(raw.categorie).slice(0, 50) : null,
            tiers: typeof raw.tiers === 'string' && raw.tiers !== 'null' ? sanitizeInput(raw.tiers).slice(0, 100) : null,
            tvaRate: typeof raw.tvaRate === 'number' ? raw.tvaRate : null,
            montantHT: typeof raw.montantHT === 'number' ? Math.abs(raw.montantHT) : null,
            montantTVA: typeof raw.montantTVA === 'number' ? Math.abs(raw.montantTVA) : null,
          };

          // Auto-calculate TVA if rate and amount present but HT missing
          if (entry.tvaRate && entry.montant && !entry.montantHT) {
            entry.montantHT = parseFloat((entry.montant / (1 + entry.tvaRate / 100)).toFixed(2));
            entry.montantTVA = parseFloat((entry.montant - entry.montantHT).toFixed(2));
          }
        }
      }
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    console.log("Final result:", { transcription: finalTranscript, entry });

    return new Response(JSON.stringify({ transcription: finalTranscript, entry }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("voice-transcribe error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur de transcription" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});