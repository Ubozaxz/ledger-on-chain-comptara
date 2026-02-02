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
            content: `Tu es un assistant de transcription et d'extraction de données comptables.
            
Quand tu reçois une demande de transcription vocale, tu dois:
1. Générer une transcription réaliste d'une opération comptable en français
2. Extraire les données comptables structurées

Retourne TOUJOURS un JSON avec ce format exact:
{
  "transcription": "texte transcrit simulé d'une opération comptable réaliste",
  "entry": {
    "montant": number,
    "devise": "HBAR" ou "EUR" ou "USDC",
    "description": "description de l'opération",
    "type": "debit" ou "credit",
    "categorie": "catégorie comptable",
    "tiers": "nom du fournisseur ou client si mentionné"
  }
}

Génère des exemples variés et réalistes d'opérations comptables.`
          },
          {
            role: "user",
            content: `Génère une transcription simulée d'une opération comptable dictée vocalement et extrais les données structurées.

La transcription doit être réaliste, comme si quelqu'un dictait une opération comptable. Par exemple:
- "Paiement de 250 euros à Amazon pour fournitures de bureau"
- "Encaissement de 1500 HBAR du client Acme Corp"
- "Facture fournisseur de 850 euros pour services marketing"

Génère un nouvel exemple différent et retourne le JSON structuré.`
          }
        ],
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
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
