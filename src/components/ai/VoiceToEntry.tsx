import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceToEntryProps {
  onEntryExtracted: (entry: any) => void;
}

export const VoiceToEntry = ({ onEntryExtracted }: VoiceToEntryProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Erreur de reconnaissance vocale",
          description: event.error === 'not-allowed' 
            ? "Veuillez autoriser l'accès au microphone" 
            : "Erreur lors de la reconnaissance vocale",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          setIsListening(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Non supporté",
        description: "Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Edge.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript) {
        processTranscription(transcript);
      }
    } else {
      setTranscript("");
      setLastResult(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const processTranscription = async (text: string) => {
    setIsProcessing(true);
    
    try {
      const { buildJsonHeaders } = await import('@/lib/auth-headers');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: await buildJsonHeaders(),
        body: JSON.stringify({
          action: "voice-to-entry",
          transcription: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process transcription");
      }

      // Parse streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) fullResponse += content;
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Try to extract JSON from response
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        setLastResult(extractedData);
        onEntryExtracted(extractedData);
        toast({
          title: "Écriture extraite",
          description: `${extractedData.description || 'Nouvelle écriture'} - ${extractedData.montant} ${extractedData.devise || 'HBAR'}`,
        });
      } else {
        setLastResult({ raw: fullResponse });
        toast({
          title: "Analyse terminée",
          description: "Réponse de l'IA reçue",
        });
      }
    } catch (error: any) {
      console.error("Voice processing error:", error);
      toast({
        title: "Erreur de traitement",
        description: error.message || "Impossible de traiter la transcription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const SpeechSupported = typeof window !== 'undefined' && 
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

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

        {!SpeechSupported && (
          <div className="flex items-center space-x-2 text-warning bg-warning/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Reconnaissance vocale non supportée. Utilisez Chrome ou Edge.</span>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          <Button
            onClick={toggleListening}
            disabled={isProcessing || !SpeechSupported}
            size="lg"
            className={`h-20 w-20 rounded-full transition-all duration-300 ${
              isListening 
                ? 'bg-destructive hover:bg-destructive/90 animate-pulse' 
                : 'bg-gradient-primary hover:opacity-90'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isListening ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            {isProcessing 
              ? "Analyse en cours..." 
              : isListening 
                ? "Parlez maintenant... (cliquez pour arrêter)" 
                : "Cliquez pour dicter"}
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
