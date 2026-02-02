import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Square, BookOpen, CreditCard, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtractedEntry {
  montant?: number;
  devise?: string;
  categorie?: string;
  tiers?: string;
  description?: string;
  type?: "debit" | "credit";
  txHash?: string;
  raw?: string;
}

interface VoiceToEntryProps {
  onEntryExtracted: (entry: ExtractedEntry) => void;
  onInsertToJournal?: (entry: ExtractedEntry) => void;
  onInsertToPayment?: (entry: ExtractedEntry) => void;
}

// Check if browser supports MediaRecorder
const hasMediaRecorder = typeof MediaRecorder !== "undefined";

export const VoiceToEntry = ({ onEntryExtracted, onInsertToJournal, onInsertToPayment }: VoiceToEntryProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResult, setLastResult] = useState<ExtractedEntry | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use supported mime type
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("");
      setLastResult(null);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      toast({
        title: "Accès micro refusé",
        description: "Autorisez l'accès au microphone dans les paramètres du navigateur",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Call edge function for transcription + extraction
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ audio: base64Audio }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${response.status}`);
      }

      const data = await response.json();
      setTranscript(data.transcription || "");

      if (data.entry) {
        const entry: ExtractedEntry = {
          montant: data.entry.montant,
          devise: data.entry.devise || "HBAR",
          categorie: data.entry.categorie,
          tiers: data.entry.tiers,
          description: data.entry.description,
          type: data.entry.type,
          txHash: data.entry.txHash,
        };
        setLastResult(entry);
        onEntryExtracted(entry);
        toast({
          title: "Données extraites",
          description: `${entry.description || "Nouvelle écriture"} - ${entry.montant} ${entry.devise}`,
        });
      } else {
        setLastResult({ raw: data.transcription });
        toast({ 
          title: "Transcription terminée", 
          description: data.transcription?.slice(0, 60) || "Aucun texte détecté" 
        });
      }
    } catch (error: any) {
      console.error("Voice processing error:", error);
      toast({
        title: "Erreur de traitement",
        description: error.message || "Impossible de traiter l'audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleInsertToJournal = () => {
    if (lastResult && onInsertToJournal) {
      onInsertToJournal(lastResult);
      toast({ title: "Inséré dans Journal", description: "Les données ont été ajoutées au formulaire" });
    }
  };

  const handleInsertToPayment = () => {
    if (lastResult && onInsertToPayment) {
      onInsertToPayment(lastResult);
      toast({ title: "Inséré dans Paiement", description: "Les données ont été ajoutées au formulaire" });
    }
  };

  const copyToClipboard = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      toast({ title: "Copié", description: "Transcription copiée dans le presse-papier" });
    }
  };

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Mic className="h-5 w-5 text-primary" />
          <span>Voice-to-Entry</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Dictez votre écriture comptable ou paiement. L'IA analysera et extraira les données automatiquement.
        </p>

        {!hasMediaRecorder && (
          <div className="flex items-center space-x-2 text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Enregistrement audio non supporté sur ce navigateur.</span>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          <Button
            onClick={toggleRecording}
            disabled={isProcessing || !hasMediaRecorder}
            size="lg"
            className={`h-20 w-20 rounded-full transition-all duration-300 touch-manipulation ${
              isRecording
                ? "bg-destructive hover:bg-destructive/90 animate-pulse"
                : "bg-gradient-primary hover:opacity-90"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {isProcessing
              ? "Analyse en cours..."
              : isRecording
              ? "Enregistrement... (appuyez pour arrêter)"
              : "Appuyez pour dicter"}
          </p>
        </div>

        {transcript && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Transcription</p>
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 px-2">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {lastResult && lastResult.montant && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <p className="text-xs text-success uppercase tracking-wider">Données extraites</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {lastResult.montant && (
                <div>
                  <span className="text-muted-foreground">Montant:</span>{" "}
                  <span className="font-medium">{lastResult.montant} {lastResult.devise}</span>
                </div>
              )}
              {lastResult.categorie && (
                <div>
                  <span className="text-muted-foreground">Catégorie:</span>{" "}
                  <span className="font-medium">{lastResult.categorie}</span>
                </div>
              )}
              {lastResult.tiers && (
                <div>
                  <span className="text-muted-foreground">Tiers:</span>{" "}
                  <span className="font-medium">{lastResult.tiers}</span>
                </div>
              )}
              {lastResult.type && (
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="font-medium">{lastResult.type}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {onInsertToJournal && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleInsertToJournal}
                  className="flex-1 border-primary/30 hover:bg-primary/10"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Insérer en écriture
                </Button>
              )}
              {onInsertToPayment && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleInsertToPayment}
                  className="flex-1 border-primary/30 hover:bg-primary/10"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Insérer en paiement
                </Button>
              )}
            </div>
          </div>
        )}

        {lastResult && !lastResult.montant && lastResult.raw && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Aucune donnée comptable détectée</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Essayez de dicter plus clairement avec le montant, la devise et la description.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
