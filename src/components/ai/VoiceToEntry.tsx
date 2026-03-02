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

const hasMediaRecorder = typeof MediaRecorder !== "undefined";
const hasSpeechRecognition = typeof window !== "undefined" && 
  (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

// Max recording: 5 minutes
const MAX_RECORDING_SECONDS = 300;

export const VoiceToEntry = ({ onEntryExtracted, onInsertToJournal, onInsertToPayment }: VoiceToEntryProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastResult, setLastResult] = useState<ExtractedEntry | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [useSpeechAPI, setUseSpeechAPI] = useState(hasSpeechRecognition);
  const [autoSaveCloud, setAutoSaveCloud] = useState(true);
  const [autoSaveBlockchain, setAutoSaveBlockchain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= MAX_RECORDING_SECONDS - 1) {
          stopRecordingAll();
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
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  };

  // Auto-save extracted entry
  const autoSaveEntry = async (entry: ExtractedEntry) => {
    if (!entry.montant) return;
    setIsSaving(true);

    try {
      if (autoSaveCloud && onInsertToJournal) {
        onInsertToJournal(entry);
        toast({
          title: "💾 Sauvegardé automatiquement",
          description: `${entry.montant} ${entry.devise || 'XOF'} — enregistré dans le Cloud`,
        });
      }

      if (autoSaveBlockchain && onInsertToJournal) {
        // The blockchain anchoring happens within the journal entry handler
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

  // ---- Web Speech API (real-time transcription) ----
  const startSpeechRecognition = useCallback(async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      transcriptRef.current = "";

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "fr-FR";
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsRecording(true);
        setTranscript("");
        setLiveTranscript("");
        setLastResult(null);
        startTimer();
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          // Pick the best alternative
          let bestText = result[0].transcript;
          let bestConfidence = result[0].confidence || 0;
          for (let a = 1; a < result.length; a++) {
            if ((result[a].confidence || 0) > bestConfidence) {
              bestText = result[a].transcript;
              bestConfidence = result[a].confidence;
            }
          }
          if (result.isFinal) {
            final += bestText + " ";
          } else {
            interim += bestText;
          }
        }
        if (final) {
          transcriptRef.current = final;
        }
        setLiveTranscript((final + interim).trim());
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          toast({
            title: "Microphone non autorisé",
            description: "Autorisez l'accès au microphone dans les paramètres du navigateur",
            variant: "destructive",
          });
          stopRecordingAll();
        } else if (event.error === "no-speech") {
          // Don't stop — just wait for speech
          toast({ title: "En attente de parole...", description: "Parlez plus près du microphone" });
        } else if (event.error === "aborted") {
          // Normal stop
        } else {
          stopRecordingAll();
        }
      };

      recognition.onend = async () => {
        stopTimer();
        setIsRecording(false);
        setAudioLevel(0);
        const finalText = transcriptRef.current.trim();
        if (finalText) {
          setTranscript(finalText);
          setLiveTranscript("");
          await extractFromTranscript(finalText);
        } else {
          toast({ title: "Aucune parole détectée", description: "Réessayez en parlant clairement", variant: "destructive" });
        }
      };

      // Start audio context for visual feedback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const updateLevel = () => {
          if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(average / 255);
          }
          animationRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();

        // Store stream ref for cleanup
        mediaRecorderRef.current = { stop: () => { stream.getTracks().forEach(t => t.stop()); audioContext.close(); } } as any;
      } catch {}

      recognition.start();
    } catch (err: any) {
      console.error("Speech recognition start error:", err);
      setUseSpeechAPI(false);
      await startMediaRecorder();
    }
  }, []);

  // ---- MediaRecorder fallback ----
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationRef.current = requestAnimationFrame(updateLevel);
      };

      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/ogg";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        setAudioLevel(0);
        toast({
          title: "Transcription non disponible",
          description: "Utilisez Chrome ou Edge pour la transcription vocale automatique",
          variant: "destructive",
        });
        setIsProcessing(false);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setTranscript("");
      setLastResult(null);
      startTimer();
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

  const stopRecordingAll = () => {
    stopTimer();
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaRecorderRef.current) {
      try {
        if ('state' in mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        } else if (!('state' in mediaRecorderRef.current)) {
          // Audio-only cleanup ref
          (mediaRecorderRef.current as any).stop?.();
        }
      } catch {}
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAudioLevel(0);
  };

  const extractFromTranscript = async (text: string) => {
    setIsProcessing(true);
    try {
      const headers = await buildJsonHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ transcript: text }),
        }
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
          description: `${entry.description || "Écriture"} — ${entry.montant} ${entry.devise}`,
        });

        // Auto-save if enabled
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
      stopRecordingAll();
    } else {
      if (useSpeechAPI) {
        await startSpeechRecognition();
      } else {
        await startMediaRecorder();
      }
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
    const text = transcript || liveTranscript;
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ title: "Copié", description: "Transcription copiée dans le presse-papier" });
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Mic className="h-5 w-5 text-primary" />
            <span className="text-base">Voice-to-Entry</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <Wand2 className="h-3 w-3 mr-1" />
              IA Réelle
            </Badge>
            <Badge variant="outline" className="text-xs bg-accent/10 text-accent-foreground border-accent/20">
              Max {Math.floor(MAX_RECORDING_SECONDS / 60)} min
            </Badge>
            {useSpeechAPI ? (
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                Transcription Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                Mode basique
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Dictez votre opération comptable en français. L'IA extrait automatiquement montant, TVA, catégorie et tiers <span className="text-primary font-medium">depuis votre vraie voix</span>.
        </p>

        {/* Auto-save options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Cloud className="h-4 w-4 text-primary" />
              <Label className="text-xs font-medium">Auto-save Cloud</Label>
            </div>
            <Switch checked={autoSaveCloud} onCheckedChange={setAutoSaveCloud} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Link2 className="h-4 w-4 text-primary" />
              <Label className="text-xs font-medium">Auto-save Blockchain</Label>
            </div>
            <Switch checked={autoSaveBlockchain} onCheckedChange={setAutoSaveBlockchain} />
          </div>
        </div>

        {!hasMediaRecorder && !hasSpeechRecognition && (
          <div className="flex items-center space-x-2 text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Enregistrement audio non supporté. Utilisez Chrome ou Safari sur iOS.</span>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          {/* Audio Level Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-1 h-10">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 sm:w-1.5 bg-primary rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(6, Math.min(40, audioLevel * 40 + Math.random() * 10))}px`,
                    opacity: audioLevel > i * 0.05 ? 1 : 0.2
                  }}
                />
              ))}
            </div>
          )}

          <Button
            onClick={toggleRecording}
            disabled={isProcessing || isSaving || (!hasMediaRecorder && !hasSpeechRecognition)}
            size="lg"
            className={`h-20 w-20 rounded-full transition-all duration-300 touch-manipulation ${
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
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isRecording ? (
              <Square className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>

          <div className="text-center space-y-1">
            {isRecording && (
              <div className="space-y-1">
                <Badge variant="destructive" className="animate-pulse">
                  <Volume2 className="h-3 w-3 mr-1" />
                  {formatTime(recordingTime)} — Enregistrement en cours
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  Temps restant: {formatTime(remainingTime)}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isSaving
                ? "Sauvegarde automatique..."
                : isProcessing
                ? "Analyse IA en cours..."
                : isRecording
                ? "Parlez maintenant — appuyez pour arrêter"
                : "Appuyez pour dicter votre écriture"}
            </p>
            {(autoSaveCloud || autoSaveBlockchain) && !isRecording && (
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <Save className="h-3 w-3" />
                <span>
                  Sauvegarde auto: {[autoSaveCloud && "Cloud", autoSaveBlockchain && "Blockchain"].filter(Boolean).join(" + ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live + final transcript */}
        {displayTranscript && (
          <div className={`rounded-lg p-4 space-y-2 ${liveTranscript && isRecording ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {isRecording ? "🔴 Transcription en direct" : "Transcription"}
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
            <p className="text-sm leading-relaxed">{displayTranscript}</p>
          </div>
        )}

        {/* Extracted data display */}
        {lastResult && lastResult.montant && (
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="text-xs text-success uppercase tracking-wider font-medium">Données extraites de votre audio</p>
              </div>
              {(autoSaveCloud || autoSaveBlockchain) && (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                  <Save className="h-3 w-3 mr-1" />
                  Sauvegardé
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-background/50 rounded-lg p-3">
                <span className="text-xs text-muted-foreground block mb-1">Montant TTC</span>
                <span className="font-bold text-lg">{lastResult.montant} {lastResult.devise}</span>
              </div>
              {lastResult.montantHT && (
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Montant HT</span>
                  <span className="font-semibold">{lastResult.montantHT} {lastResult.devise}</span>
                </div>
              )}
              {lastResult.tvaRate !== undefined && lastResult.tvaRate !== null && (
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">TVA</span>
                  <span className="font-semibold">{lastResult.tvaRate}% {lastResult.montantTVA ? `— ${lastResult.montantTVA} ${lastResult.devise}` : ''}</span>
                </div>
              )}
              {lastResult.categorie && (
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Catégorie</span>
                  <span className="font-medium text-xs">{lastResult.categorie}</span>
                </div>
              )}
              {lastResult.tiers && (
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Tiers</span>
                  <span className="font-medium text-xs">{lastResult.tiers}</span>
                </div>
              )}
              {lastResult.type && (
                <div className="bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Type</span>
                  <Badge variant={lastResult.type === 'credit' ? 'default' : 'secondary'} className="text-xs">
                    {lastResult.type === 'credit' ? '↑ Crédit' : '↓ Débit'}
                  </Badge>
                </div>
              )}
              {lastResult.description && (
                <div className="col-span-2 bg-background/50 rounded-lg p-3">
                  <span className="text-xs text-muted-foreground block mb-1">Description</span>
                  <span className="font-medium text-xs">{lastResult.description}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {onInsertToJournal && !(autoSaveCloud) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertToJournal}
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-11 touch-manipulation"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Écriture journal
                </Button>
              )}
              {onInsertToPayment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInsertToPayment}
                  className="flex-1 border-primary/30 hover:bg-primary/10 h-11 touch-manipulation"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Paiement
                </Button>
              )}
            </div>
          </div>
        )}

        {lastResult && !lastResult.montant && lastResult.raw && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-xs text-warning font-medium">Montant non détecté</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Précisez le montant et la devise dans votre dictée.
            </p>
            <p className="text-xs text-muted-foreground font-medium">Exemples :</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>«&nbsp;Achat fournitures bureau 75 000 francs CFA TVA 18% chez Prosuma&nbsp;»</li>
              <li>«&nbsp;Facture MTN 150 000 FCFA abonnement internet&nbsp;»</li>
              <li>«&nbsp;Encaissement client Solibra 2 500 000 XOF prestation conseil&nbsp;»</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};