import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Square, BookOpen, CreditCard, Copy, Wand2, Volume2 } from "lucide-react";
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
  tvaRate?: number;
  montantHT?: number;
  montantTVA?: number;
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
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio analyser for visual feedback
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Animate audio level
      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        if (isRecording) {
          animationRef.current = requestAnimationFrame(updateLevel);
        }
      };
      
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
        audioContext.close();
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("");
      setLastResult(null);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start audio level animation
      updateLevel();
      
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setAudioLevel(0);
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
          tvaRate: data.entry.tvaRate,
          montantHT: data.entry.montantHT,
          montantTVA: data.entry.montantTVA,
        };
        setLastResult(entry);
        onEntryExtracted(entry);
        toast({
          title: "Données extraites avec succès",
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mic className="h-5 w-5 text-primary" />
            <span>Voice-to-Entry</span>
          </div>
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            <Wand2 className="h-3 w-3 mr-1" />
            IA Avancée
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Dictez votre écriture comptable. L'IA analysera et extraira automatiquement les données (montant, TVA, catégorie, tiers).
        </p>

        {!hasMediaRecorder && (
          <div className="flex items-center space-x-2 text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Enregistrement audio non supporté sur ce navigateur.</span>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          {/* Audio Level Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-1 h-8">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1 bg-primary rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(8, Math.min(32, audioLevel * 32 + Math.random() * 8))}px`,
                    opacity: audioLevel > i * 0.08 ? 1 : 0.3
                  }}
                />
              ))}
            </div>
          )}
          
          <Button
            onClick={toggleRecording}
            disabled={isProcessing || !hasMediaRecorder}
            size="lg"
            className={`h-20 w-20 rounded-full transition-all duration-300 touch-manipulation ${
              isRecording
                ? "bg-destructive hover:bg-destructive/90 scale-110"
                : "bg-gradient-primary hover:opacity-90"
            }`}
            style={{
              boxShadow: isRecording 
                ? `0 0 ${20 + audioLevel * 30}px rgba(239, 68, 68, ${0.4 + audioLevel * 0.4})` 
                : undefined
            }}
          >
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>

          <div className="text-center">
            {isRecording && (
              <Badge variant="destructive" className="mb-2 animate-pulse">
                <Volume2 className="h-3 w-3 mr-1" />
                {formatTime(recordingTime)}
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {isProcessing
                ? "Analyse IA en cours..."
                : isRecording
                ? "Parlez maintenant (appuyez pour arrêter)"
                : "Appuyez pour dicter"}
            </p>
          </div>
        </div>

        {transcript && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Transcription</p>
              <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 px-2">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-sm leading-relaxed">{transcript}</p>
          </div>
        )}

        {lastResult && lastResult.montant && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <p className="text-xs text-success uppercase tracking-wider font-medium">Données extraites</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              {lastResult.montant && (
                <div className="bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">Montant</span>
                  <span className="font-bold text-lg">{lastResult.montant} {lastResult.devise}</span>
                </div>
              )}
              {lastResult.categorie && (
                <div className="bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">Catégorie</span>
                  <span className="font-medium">{lastResult.categorie}</span>
                </div>
              )}
              {lastResult.tiers && (
                <div className="bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">Tiers</span>
                  <span className="font-medium">{lastResult.tiers}</span>
                </div>
              )}
              {lastResult.type && (
                <div className="bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">Type</span>
                  <Badge variant={lastResult.type === 'credit' ? 'default' : 'secondary'}>
                    {lastResult.type}
                  </Badge>
                </div>
              )}
              {lastResult.tvaRate && (
                <div className="bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">TVA</span>
                  <span className="font-medium">{lastResult.tvaRate}%</span>
                </div>
              )}
              {lastResult.description && (
                <div className="col-span-2 bg-background/50 rounded-lg p-2">
                  <span className="text-xs text-muted-foreground block">Description</span>
                  <span className="font-medium">{lastResult.description}</span>
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
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-10"
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
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-10"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Insérer en paiement
                </Button>
              )}
            </div>
          </div>
        )}

        {lastResult && !lastResult.montant && lastResult.raw && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-xs text-warning font-medium">Données incomplètes</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Essayez de dicter plus clairement avec le montant, la devise et la description. 
              Exemple: "Achat fournitures bureau 150 euros TVA 20% chez Office Depot"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};