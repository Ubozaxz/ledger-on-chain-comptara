import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Square, BookOpen, CreditCard, Copy, Wand2, Volume2, RefreshCw, Save, Cloud, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildJsonHeaders } from "@/lib/auth-headers";

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

const hasSpeechRecognition = typeof window !== "undefined" && 
  (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

const MAX_RECORDING_SECONDS = 300;

export const VoiceToEntry = ({ onEntryExtracted, onInsertToJournal, onInsertToPayment }: VoiceToEntryProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastResult, setLastResult] = useState<ExtractedEntry | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [autoSaveCloud, setAutoSaveCloud] = useState(true);
  const [autoSaveBlockchain, setAutoSaveBlockchain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const finalPartsRef = useRef<string[]>([]);
  const liveTranscriptRef = useRef("");
  const lastSpeechAtRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const cleanup = () => {
    isListeningRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  };

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_SECONDS - 1) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const autoSaveEntry = async (entry: ExtractedEntry) => {
    if (!entry.montant) return;
    setIsSaving(true);
    try {
      if (autoSaveCloud && onInsertToJournal) {
        onInsertToJournal(entry);
        toast({
          title: "💾 Sauvegardé automatiquement",
          description: `${entry.montant?.toLocaleString('fr-FR')} ${entry.devise || 'XOF'} — enregistré dans le Cloud`,
        });
      }
      if (autoSaveBlockchain && onInsertToJournal) {
        toast({
          title: "⛓️ Ancrage blockchain demandé",
          description: "L'écriture sera ancrée via votre wallet",
        });
      }
    } catch (err: any) {
      console.error("Auto-save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const startAudioVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      audioStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current || !isListeningRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error("Audio visualizer error:", err);
    }
  };

  // Core: start speech recognition directly from user gesture
  const startRecording = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Non supporté",
        description: "Utilisez Chrome, Edge ou Safari pour la reconnaissance vocale",
        variant: "destructive",
      });
      return;
    }

    // Clean up previous instance
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    finalPartsRef.current = [];
      liveTranscriptRef.current = "";
      lastSpeechAtRef.current = null;
      finishingRef.current = false;
    isListeningRef.current = true;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let interim = "";
      let sessionFinal = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Pick best alternative
        let bestText = result[0].transcript;
        let bestConfidence = result[0].confidence || 0;
        for (let a = 1; a < result.length; a++) {
          if ((result[a].confidence || 0) > bestConfidence) {
            bestText = result[a].transcript;
            bestConfidence = result[a].confidence;
          }
        }
        if (result.isFinal) {
          sessionFinal += bestText + " ";
        } else {
          interim += bestText;
        }
      }
      
      if (sessionFinal.trim()) {
        finalPartsRef.current.push(sessionFinal.trim());
        lastSpeechAtRef.current = Date.now();
      } else if (interim.trim()) {
        lastSpeechAtRef.current = Date.now();
      }
      
      const accumulated = finalPartsRef.current.join(" ");
      const fullText = accumulated + (interim ? " " + interim : "");
      liveTranscriptRef.current = fullText.trim();
      setLiveTranscript(fullText.trim());
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast({
          title: "Microphone non autorisé",
          description: "Autorisez l'accès au microphone dans les paramètres du navigateur",
          variant: "destructive",
        });
        isListeningRef.current = false;
        setIsRecording(false);
        stopTimer();
        cleanupAudio();
      }
      // For "no-speech", "aborted", "network" — onend will handle restart
    };

    recognition.onend = () => {
      console.log("Speech recognition onend, isListening:", isListeningRef.current);
      if (isListeningRef.current) {
        // AUTO-RESTART: This is the key fix — browser stops after silence,
        // but we keep restarting as long as user hasn't clicked stop
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              console.log("Auto-restarting speech recognition...");
              recognitionRef.current.start();
            } catch (e) {
              console.warn("Restart failed, retrying in 500ms:", e);
              setTimeout(() => {
                if (isListeningRef.current && recognitionRef.current) {
                  try { recognitionRef.current.start(); } catch {}
                }
              }, 500);
            }
          }
        }, 200);
      } else {
        // User manually stopped — process transcript
        if (finishingRef.current) return;
        finishingRef.current = true;
        const finalText = (liveTranscriptRef.current || finalPartsRef.current.join(" ")).trim();
        setIsRecording(false);
        setAudioLevel(0);
        stopTimer();
        cleanupAudio();
        
        if (finalText) {
          setTranscript(finalText);
          setLiveTranscript("");
          extractFromTranscript(finalText);
        } else {
          toast({ 
            title: "Aucune parole détectée", 
            description: "Parlez clairement dans le micro et réessayez",
            variant: "destructive" 
          });
        }
      }
    };

    // Start audio visualizer FIRST (needs getUserMedia)
    await startAudioVisualizer();
    
    // Start recognition directly from click handler (user gesture)
    try {
      recognition.start();
      setIsRecording(true);
      setTranscript("");
      setLiveTranscript("");
      setLastResult(null);
      startTimer();
      toast({ title: "🎙️ Enregistrement démarré", description: "Parlez maintenant — l'IA écoute en continu" });
    } catch (err: any) {
      console.error("Failed to start recognition:", err);
      toast({
        title: "Erreur micro",
        description: "Impossible de démarrer l'enregistrement. Vérifiez les permissions.",
        variant: "destructive",
      });
      isListeningRef.current = false;
      cleanupAudio();
    }
  }, []);

  const cleanupAudio = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
  };

  const stopRecording = useCallback(() => {
    console.log("stopRecording called");
    isListeningRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    stopTimer();
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      // onend handler will process the transcript
    }
    
    setAudioLevel(0);
  }, []);

  const extractFromTranscript = async (text: string) => {
    setIsProcessing(true);
    try {
      const headers = await buildJsonHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
        { method: "POST", headers, body: JSON.stringify({ transcript: text }) }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${response.status}`);
      }

      const data = await response.json();
      setTranscript(data.transcription || text);

      if (data.entry && data.entry.montant) {
        const entry: ExtractedEntry = {
          montant: data.entry.montant,
          devise: data.entry.devise || "XOF",
          categorie: data.entry.categorie,
          tiers: data.entry.tiers,
          description: data.entry.description,
          type: data.entry.type,
          tvaRate: data.entry.tvaRate,
          montantHT: data.entry.montantHT,
          montantTVA: data.entry.montantTVA,
        };
        setLastResult(entry);
        onEntryExtracted(entry);
        toast({
          title: "✅ Données extraites",
          description: `${entry.description || "Écriture"} — ${entry.montant?.toLocaleString('fr-FR')} ${entry.devise}`,
        });
        if (autoSaveCloud || autoSaveBlockchain) {
          await autoSaveEntry(entry);
        }
      } else {
        setLastResult({ raw: text });
        toast({
          title: "Transcription enregistrée",
          description: "Montant non détecté. Précisez le montant et la devise.",
        });
      }
    } catch (error: any) {
      console.error("Voice processing error:", error);
      toast({
        title: "Erreur d'extraction",
        description: error.message || "Impossible d'analyser l'audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleInsertToJournal = () => {
    if (lastResult && onInsertToJournal) {
      onInsertToJournal(lastResult);
      toast({ title: "Inséré dans Journal", description: "Les données ont été ajoutées" });
    }
  };

  const handleInsertToPayment = () => {
    if (lastResult && onInsertToPayment) {
      onInsertToPayment(lastResult);
      toast({ title: "Inséré dans Paiement", description: "Les données ont été ajoutées" });
    }
  };

  const copyToClipboard = () => {
    const text = transcript || liveTranscript;
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ title: "Copié", description: "Transcription copiée" });
    }
  };

  const retryExtraction = () => {
    if (transcript) extractFromTranscript(transcript);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTranscript = liveTranscript || transcript;
  const remainingTime = MAX_RECORDING_SECONDS - recordingTime;

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3 p-3 sm:p-6">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Mic className="h-5 w-5 text-primary" />
            <span className="text-sm sm:text-base">Voice-to-Entry</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] sm:text-xs bg-primary/10 text-primary border-primary/20">
              <Wand2 className="h-3 w-3 mr-1" />
              IA
            </Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs bg-accent/10 text-accent-foreground border-accent/20">
              {Math.floor(MAX_RECORDING_SECONDS / 60)}min
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0">
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Dictez votre opération en français. L'IA extrait montant, TVA, catégorie et tiers automatiquement.
        </p>

        {/* Auto-save options */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-1.5">
              <Cloud className="h-3.5 w-3.5 text-primary" />
              <Label className="text-[10px] sm:text-xs font-medium">Cloud</Label>
            </div>
            <Switch checked={autoSaveCloud} onCheckedChange={setAutoSaveCloud} />
          </div>
          <div className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-1.5">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              <Label className="text-[10px] sm:text-xs font-medium">Chain</Label>
            </div>
            <Switch checked={autoSaveBlockchain} onCheckedChange={setAutoSaveBlockchain} />
          </div>
        </div>

        {!hasSpeechRecognition && (
          <div className="flex items-center space-x-2 text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs">Utilisez Chrome, Edge ou Safari pour la reconnaissance vocale.</span>
          </div>
        )}

        <div className="flex flex-col items-center space-y-3">
          {/* Audio Level Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-0.5 h-8">
              {[...Array(16)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, Math.min(32, audioLevel * 32 + Math.random() * 8))}px`,
                    opacity: audioLevel > i * 0.06 ? 1 : 0.2
                  }}
                />
              ))}
            </div>
          )}

          <Button
            onClick={toggleRecording}
            disabled={isProcessing || isSaving || !hasSpeechRecognition}
            size="lg"
            className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full transition-all duration-300 touch-manipulation ${
              isRecording
                ? "bg-destructive hover:bg-destructive/90 scale-110 animate-pulse"
                : "bg-gradient-primary hover:opacity-90"
            }`}
            style={{
              boxShadow: isRecording
                ? `0 0 ${24 + audioLevel * 32}px rgba(239, 68, 68, ${0.5 + audioLevel * 0.4})`
                : undefined
            }}
          >
            {isProcessing || isSaving ? (
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
            ) : isRecording ? (
              <Square className="h-6 w-6 sm:h-8 sm:w-8" />
            ) : (
              <Mic className="h-6 w-6 sm:h-8 sm:w-8" />
            )}
          </Button>

          <div className="text-center space-y-1">
            {isRecording && (
              <div className="space-y-0.5">
                <Badge variant="destructive" className="animate-pulse text-xs">
                  <Volume2 className="h-3 w-3 mr-1" />
                  {formatTime(recordingTime)}
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  Restant: {formatTime(remainingTime)}
                </p>
              </div>
            )}
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isSaving ? "Sauvegarde..." : isProcessing ? "Analyse IA..." : isRecording ? "Parlez — appuyez ■ pour arrêter" : "Appuyez pour dicter"}
            </p>
          </div>
        </div>

        {/* Live + final transcript */}
        {displayTranscript && (
          <div className={`rounded-lg p-3 space-y-2 ${liveTranscript && isRecording ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {isRecording ? "🔴 En direct" : "Transcription"}
              </p>
              {!isRecording && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 px-2">
                    <Copy className="h-3 w-3" />
                  </Button>
                  {transcript && (
                    <Button variant="ghost" size="sm" onClick={retryExtraction} className="h-7 px-2" disabled={isProcessing}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs sm:text-sm leading-relaxed break-words">{displayTranscript}</p>
          </div>
        )}

        {/* Extracted data display */}
        {lastResult && lastResult.montant && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="text-[10px] sm:text-xs text-success uppercase tracking-wider font-medium">Données extraites</p>
              </div>
              {(autoSaveCloud || autoSaveBlockchain) && (
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                  <Save className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-sm">
              <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                <span className="text-[10px] text-muted-foreground block mb-0.5">Montant TTC</span>
                <span className="font-bold text-sm sm:text-lg">{lastResult.montant?.toLocaleString('fr-FR')} {lastResult.devise}</span>
              </div>
              {lastResult.montantHT && (
                <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">HT</span>
                  <span className="font-semibold text-xs sm:text-sm">{lastResult.montantHT?.toLocaleString('fr-FR')} {lastResult.devise}</span>
                </div>
              )}
              {lastResult.tvaRate != null && (
                <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">TVA</span>
                  <span className="font-semibold text-xs sm:text-sm">{lastResult.tvaRate}%</span>
                </div>
              )}
              {lastResult.categorie && (
                <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Catégorie</span>
                  <span className="font-medium text-xs">{lastResult.categorie}</span>
                </div>
              )}
              {lastResult.tiers && (
                <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Tiers</span>
                  <span className="font-medium text-xs">{lastResult.tiers}</span>
                </div>
              )}
              {lastResult.type && (
                <div className="bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Type</span>
                  <Badge variant={lastResult.type === 'credit' ? 'default' : 'secondary'} className="text-[10px]">
                    {lastResult.type === 'credit' ? '↑ Crédit' : '↓ Débit'}
                  </Badge>
                </div>
              )}
              {lastResult.description && (
                <div className="col-span-2 bg-background/50 rounded-lg p-2 sm:p-3">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Description</span>
                  <span className="font-medium text-xs">{lastResult.description}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              {onInsertToJournal && !autoSaveCloud && (
                <Button variant="outline" size="sm" onClick={handleInsertToJournal}
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-10 touch-manipulation text-xs">
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  Journal
                </Button>
              )}
              {onInsertToPayment && (
                <Button variant="outline" size="sm" onClick={handleInsertToPayment}
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-10 touch-manipulation text-xs">
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  Paiement
                </Button>
              )}
            </div>
          </div>
        )}

        {lastResult && !lastResult.montant && lastResult.raw && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-xs text-warning font-medium">Montant non détecté</p>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Exemple : « Achat fournitures 75 000 FCFA TVA 18% chez Prosuma »
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
