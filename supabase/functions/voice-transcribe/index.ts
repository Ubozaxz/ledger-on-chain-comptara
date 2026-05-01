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

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20,
  trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100,
};

function parseFrenchNumberWords(input: string): number | null {
  const words = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    if (word === 'et') continue;
    if (SMALL_NUMBERS[word] !== undefined) {
      const value = SMALL_NUMBERS[word];
      found = true;
      if (value === 100) current = Math.max(1, current) * 100;
      else current += value;
    } else if (word === 'mille' || word === 'mil') {
      found = true;
      total += Math.max(1, current) * 1000;
      current = 0;
    } else if (word === 'million' || word === 'millions') {
      found = true;
      total += Math.max(1, current) * 1000000;
      current = 0;
    }
  }
  return found ? total + current : null;
}

function extractFallbackEntry(text: string): any | null {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const numericMatch = normalized.match(/(\d{1,3}(?:[\s.,]\d{3})+|\d+(?:[,.]\d+)?)\s*(?:fcfa|f\s*cfa|xof|francs?\s*cfa|francs?|eur|euros?|usd|dollars?|hbar|usdc)?/i);
  let montant: number | null = null;
  if (numericMatch) {
    const raw = numericMatch[1].replace(/\s/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/\.(?=\d{3}(\D|$))/g, '');
    montant = Number(raw);
  }
  if (!montant || Number.isNaN(montant)) montant = parseFrenchNumberWords(normalized);
  if (!montant || montant <= 0) return null;

  const devise = /\b(eur|euro|euros)\b/.test(normalized) ? 'EUR'
    : /\b(usd|dollar|dollars)\b/.test(normalized) ? 'USD'
    : /\busdc\b/.test(normalized) ? 'USDC'
    : /\bhbar\b/.test(normalized) ? 'HBAR'
    : 'XOF';
  const type = /(vente|encaissement|recette|client|facture client|recu de|reçu de)/.test(normalized) ? 'credit' : 'debit';
  const category = /(transport|taxi|carburant)/.test(normalized) ? 'Transport'
    : /(loyer|location)/.test(normalized) ? 'Loyer'
    : /(telephone|internet|communication)/.test(normalized) ? 'Communication'
    : /(salaire|paie)/.test(normalized) ? 'Salaires'
    : /(tva|taxe|impot)/.test(normalized) ? 'Taxes/TVA'
    : /(vente|client|encaissement)/.test(normalized) ? 'Ventes/Clients'
    : /(achat|fourniture|fournisseur|facture)/.test(normalized) ? 'Achats/Fournisseurs'
    : 'Frais généraux';
  const tvaMatch = normalized.match(/tva\s*(?:a|de)?\s*(\d{1,2}(?:[,.]\d+)?)\s*(?:%|pour\s*cent)?/i);
  const tvaRate = tvaMatch ? Number(tvaMatch[1].replace(',', '.')) : (/\btva\b/.test(normalized) ? 18 : null);
  const tiersMatch = text.match(/\b(?:chez|a|à|de|du|aupres de|auprès de)\s+([A-Za-zÀ-ÿ0-9 '&.-]{2,60})/i);
  const tiers = tiersMatch ? sanitizeInput(tiersMatch[1]).replace(/\s+tva\b.*$/i, '').slice(0, 80) : null;
  const montantHT = tvaRate ? Number((montant / (1 + tvaRate / 100)).toFixed(2)) : null;
  const montantTVA = tvaRate && montantHT ? Number((montant - montantHT).toFixed(2)) : null;

  // Date: try to detect dd/mm/yyyy or ISO date; default to today
  const dateMatch = text.match(/\b(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})\b/);
  let date = new Date().toISOString().split('T')[0];
  if (dateMatch) {
    let [_, d, m, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Default OHADA/SYSCOA accounts based on category and type
  const accountByCategory: Record<string, { debit: string; credit: string }> = {
    'Achats/Fournisseurs': { debit: '601000 - Achats', credit: '401000 - Fournisseurs' },
    'Ventes/Clients':      { debit: '411000 - Clients', credit: '701000 - Ventes' },
    'Transport':           { debit: '624000 - Transports', credit: '521000 - Banque' },
    'Loyer':               { debit: '622000 - Locations', credit: '521000 - Banque' },
    'Communication':       { debit: '626000 - Frais postaux/télécoms', credit: '521000 - Banque' },
    'Salaires':            { debit: '661000 - Charges de personnel', credit: '422000 - Personnel' },
    'Taxes/TVA':           { debit: '445660 - TVA déductible', credit: '521000 - Banque' },
    'Frais généraux':      { debit: '628000 - Divers services extérieurs', credit: '521000 - Banque' },
  };
  const accounts = accountByCategory[category] || accountByCategory['Frais généraux'];
  const compteDebit = type === 'credit' ? accounts.credit : accounts.debit;
  const compteCredit = type === 'credit' ? accounts.debit : accounts.credit;

  return { montant, devise, description: sanitizeInput(text).slice(0, 500), type, categorie: category, tiers, tvaRate, montantHT, montantTVA, date, compteDebit, compteCredit, libelle: sanitizeInput(text).slice(0, 200) };
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

    const fallbackEntry = extractFallbackEntry(finalTranscript);

    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

COMPTES OHADA/SYSCOA par défaut (à proposer dans compteDebit/compteCredit):
- Achat de fournitures/marchandises: D 601000 Achats / C 401000 Fournisseurs
- Vente: D 411000 Clients / C 701000 Ventes
- Transport: D 624000 / C 521000 Banque
- Loyer: D 622000 / C 521000
- Communication: D 626000 / C 521000
- Salaire: D 661000 / C 422000 Personnel
- TVA déductible: D 445660 / C 521000
- Frais généraux: D 628000 / C 521000
Si type=credit (vente/encaissement), inverse débit/crédit.

DATE: extrais la date dictée si présente (formats jj/mm/aaaa, "le 5 mars", etc.) au format ISO YYYY-MM-DD. Sinon utilise la date du jour.

LIBELLE: court (≤120 car.) résumé clair de l'opération en français.

Retourne UNIQUEMENT ce JSON (pas de markdown, pas de texte autour):
{"entry":{"montant":<number|null>,"devise":"XOF","description":"<texte exact>","libelle":"<libellé court>","date":"YYYY-MM-DD","type":"debit","categorie":"<catégorie>","tiers":<"nom"|null>,"tvaRate":<number|null>,"montantHT":<number|null>,"montantTVA":<number|null>,"compteDebit":"<n° - libellé>","compteCredit":"<n° - libellé>"}}`
          },
          {
            role: "user",
            content: `Transcription vocale à analyser:\n"${finalTranscript}"`
          }
        ],
        temperature: 0.02,
        max_tokens: 800,
      }),
    });

    if (!extractionResponse.ok) {
      const errText = await extractionResponse.text();
      console.error("AI extraction error:", extractionResponse.status, errText);
      if (extractionResponse.status === 429) {
        return new Response(JSON.stringify({ 
          transcription: finalTranscript,
          entry: fallbackEntry,
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
            date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : new Date().toISOString().split('T')[0],
            libelle: typeof raw.libelle === 'string' ? sanitizeInput(raw.libelle).slice(0, 200) : (typeof raw.description === 'string' ? sanitizeInput(raw.description).slice(0, 120) : finalTranscript.slice(0, 120)),
            compteDebit: typeof raw.compteDebit === 'string' ? sanitizeInput(raw.compteDebit).slice(0, 80) : null,
            compteCredit: typeof raw.compteCredit === 'string' ? sanitizeInput(raw.compteCredit).slice(0, 80) : null,
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

    if (!entry && fallbackEntry) entry = fallbackEntry;

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