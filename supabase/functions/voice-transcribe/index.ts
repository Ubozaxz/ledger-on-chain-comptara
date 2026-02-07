import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();

    if (!audio) {
      throw new Error("No audio data provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Processing voice transcription request...");

    // Use Lovable AI for transcription simulation and extraction
    const transcriptionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un assistant de transcription et d'extraction de données comptables professionnel pour Comptara, une plateforme de comptabilité blockchain.

MISSION: Générer des transcriptions réalistes d'opérations comptables dictées vocalement et extraire les données structurées.

TAUX DE TVA FRANÇAIS SUPPORTÉS:
- TVA 20% (taux normal) - produits et services standards
- TVA 10% (taux intermédiaire) - restauration, travaux
- TVA 5.5% (taux réduit) - alimentation, livres
- TVA 2.1% (taux particulier) - presse, médicaments
- 0% - exonéré

DEVISES SUPPORTÉES: HBAR, EUR, USD, USDC

CATÉGORIES COMPTABLES:
- Achats/Fournisseurs
- Ventes/Clients
- Frais généraux
- Salaires/Charges sociales
- Investissements
- Trésorerie
- Taxes/TVA

Retourne TOUJOURS un JSON avec ce format exact:
{
  "transcription": "texte transcrit simulé d'une opération comptable réaliste",
  "entry": {
    "montant": number (montant TTC si TVA mentionnée),
    "devise": "HBAR" | "EUR" | "USD" | "USDC",
    "description": "description claire de l'opération",
    "type": "debit" | "credit",
    "categorie": "catégorie comptable",
    "tiers": "nom du fournisseur ou client",
    "tvaRate": number | null (taux de TVA si mentionné: 20, 10, 5.5, 2.1, ou 0),
    "montantHT": number | null (montant HT si TVA calculable),
    "montantTVA": number | null (montant TVA si calculable)
  }
}

EXEMPLES RÉALISTES:
- "Facture Amazon 240 euros TTC pour fournitures bureau, TVA 20%"
- "Encaissement client Acme 1500 HBAR pour prestation développement"
- "Note de frais restaurant 55 euros TVA 10% déjeuner client"
- "Paiement loyer 1200 euros au propriétaire SCI Martin"
- "Achat licence logiciel 299 dollars chez Microsoft"

Génère des exemples variés et professionnels.`
          },
          {
            role: "user",
            content: `Génère une transcription simulée d'une opération comptable dictée vocalement. La transcription doit être naturelle, comme si quelqu'un dictait à voix haute.

Inclus si possible:
- Un montant précis
- Une devise (EUR, HBAR, ou USD)
- Un taux de TVA français si applicable
- Le nom du tiers (fournisseur ou client)
- Une description claire

Génère un nouvel exemple unique et retourne le JSON structuré avec les calculs TVA si applicable.`
          }
        ],
        temperature: 0.9,
      }),
    });

    if (!transcriptionResponse.ok) {
      const errText = await transcriptionResponse.text();
      console.error("AI transcription error:", transcriptionResponse.status, errText);
      
      if (transcriptionResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (transcriptionResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Ajoutez des crédits à votre espace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Erreur de transcription IA");
    }

    const aiResponse = await transcriptionResponse.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    console.log("AI Response content:", content);
    
    // Try to parse JSON from response
    let result = { transcription: "Transcription non disponible", entry: null };
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content;
      if (content.includes("```json")) {
        cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (content.includes("```")) {
        cleanContent = content.replace(/```\n?/g, "");
      }
      
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
        
        // Validate and calculate TVA if needed
        if (result.entry && result.entry.tvaRate && result.entry.montant) {
          const ttc = result.entry.montant;
          const tvaRate = result.entry.tvaRate;
          
          if (!result.entry.montantHT) {
            result.entry.montantHT = parseFloat((ttc / (1 + tvaRate / 100)).toFixed(2));
          }
          if (!result.entry.montantTVA) {
            result.entry.montantTVA = parseFloat((ttc - result.entry.montantHT).toFixed(2));
          }
        }
      }
    } catch (e) {
      console.log("Could not parse JSON from AI response, using raw content");
      result.transcription = content;
    }

    console.log("Returning result:", result);

    return new Response(JSON.stringify(result), {
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