import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceToEntryProps {
  onEntryExtracted: (entry: any) => void;
}

// Check if browser supports MediaRecorder (more universal than SpeechRecognition)
const hasMediaRecorder = typeof MediaRecorder !== "undefined";
const hasSpeechRecognition =
  typeof window !== "undefined" &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const VoiceToEntry = ({ onEntryExtracted }: VoiceToEntryProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
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

      const { buildJsonHeaders } = await import("@/lib/auth-headers");

      // Call edge function for transcription + extraction
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
        {
          method: "POST",
          headers: await buildJsonHeaders(),
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
        setLastResult(data.entry);
        onEntryExtracted(data.entry);
        toast({
          title: "Écriture extraite",
          description: `${data.entry.description || "Nouvelle écriture"} - ${data.entry.montant} ${data.entry.devise || "HBAR"}`,
        });
      } else {
        setLastResult({ raw: data.transcription });
        toast({ title: "Transcription terminée", description: data.transcription?.slice(0, 60) || "Aucun texte détecté" });
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
          Dictez votre écriture comptable et l'IA l'analysera automatiquement.
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Transcription</p>
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {lastResult && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <p className="text-xs text-success uppercase tracking-wider">Données extraites</p>
            </div>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
