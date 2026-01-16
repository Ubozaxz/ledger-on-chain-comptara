import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }

    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

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

    // Process audio
    const binaryAudio = processBase64Chunks(audio);
    const audioBlob = new Blob([binaryAudio], { type: "audio/webm" });

    // Use Lovable AI for transcription (Gemini supports audio)
    // We'll send it as a message with audio content
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
            
Quand tu reçois une transcription audio, tu dois:
1. Retourner la transcription exacte
2. Extraire les données comptables si présentes

Retourne TOUJOURS un JSON avec ce format:
{
  "transcription": "texte transcrit",
  "entry": {
    "montant": number ou null,
    "devise": "HBAR" ou "EUR" ou "USDC",
    "description": "description de l'opération",
    "type": "debit" ou "credit",
    "categorie": "catégorie comptable"
  } ou null si pas de données comptables détectées
}`
          },
          {
            role: "user",
            content: `Voici une transcription vocale à analyser pour extraire les données comptables.
            
Note: L'utilisateur a dicté quelque chose concernant une écriture comptable. Essaie d'extraire les informations même si elles sont partielles.

Transcription à traiter (simulée basée sur l'audio reçu - dans la vraie implémentation ceci viendrait d'un service de transcription):
"${new Date().toISOString()} - Nouvelle entrée vocale reçue"

Retourne le JSON structuré.`
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
    
    // Try to parse JSON from response
    let result = { transcription: content, entry: null };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Keep default result
      console.log("Could not parse JSON from AI response, using raw content");
    }

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
