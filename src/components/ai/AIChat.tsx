import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, User, Sparkles, Lightbulb, TrendingUp, FileText, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { buildJsonHeaders } from "@/lib/auth-headers";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatProps {
  ledgerData?: {
    entries: any[];
    payments: any[];
  };
}

export const AIChat = ({ ledgerData }: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Génère des suggestions contextuelles basées sur les données
  const getContextualSuggestions = () => {
    const suggestions = [];
    const entriesCount = ledgerData?.entries?.length || 0;
    const paymentsCount = ledgerData?.payments?.length || 0;
    const totalVolume = (ledgerData?.entries?.reduce((s, e) => s + (parseFloat(e.montant) || 0), 0) || 0) +
                       (ledgerData?.payments?.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0) || 0);

    if (entriesCount === 0 && paymentsCount === 0) {
      suggestions.push(
        { text: "Comment créer ma première écriture?", icon: FileText },
        { text: "Explique la comptabilité blockchain", icon: Lightbulb },
        { text: "Quels sont les avantages de Hedera?", icon: TrendingUp }
      );
    } else if (entriesCount + paymentsCount < 5) {
      suggestions.push(
        { text: "Analyse mes premières transactions", icon: Calculator },
        { text: "Comment catégoriser mes écritures?", icon: FileText },
        { text: "Conseils pour améliorer ma comptabilité", icon: Lightbulb }
      );
    } else {
      suggestions.push(
        { text: `Analyse mes ${entriesCount} écritures`, icon: Calculator },
        { text: "Détecte les anomalies dans mes données", icon: TrendingUp },
        { text: `Résume mon activité (${totalVolume.toFixed(2)} HBAR)`, icon: FileText }
      );
    }

    return suggestions;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: textToSend }]);
    setIsLoading(true);

    try {
      const headers = await buildJsonHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "chat",
          prompt: textToSend,
          ledgerData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Limite de requêtes atteinte. Réessayez dans quelques instants.");
        }
        if (response.status === 402) {
          throw new Error("Crédits IA insuffisants. Veuillez recharger votre compte.");
        }
        throw new Error(errorData.error || `Erreur: ${response.status}`);
      }

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
                if (content) {
                  fullResponse += content;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'assistant') {
                      return [...prev.slice(0, -1), { role: 'assistant', content: fullResponse }];
                    }
                    return [...prev, { role: 'assistant', content: fullResponse }];
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le message",
        variant: "destructive",
      });
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `❌ ${error.message || "Une erreur s'est produite. Veuillez réessayer."}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const contextualSuggestions = getContextualSuggestions();

  return (
    <Card className="card-modern flex flex-col h-[500px]">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>Assistant IA Comptara</span>
            <Sparkles className="h-4 w-4 text-primary/60" />
          </div>
          {ledgerData && (ledgerData.entries.length > 0 || ledgerData.payments.length > 0) && (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
              {ledgerData.entries.length + ledgerData.payments.length} transactions
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-4">
                <div className="relative">
                  <Bot className="h-14 w-14 mx-auto text-primary/30" />
                  <Sparkles className="h-5 w-5 absolute top-0 right-1/3 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Assistant IA Comptabilité Blockchain
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Posez vos questions sur la comptabilité, l'audit ou analysez vos données on-chain.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {contextualSuggestions.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 hover:bg-primary/10 hover:border-primary/30"
                      onClick={() => sendMessage(suggestion.text)}
                    >
                      <suggestion.icon className="h-3 w-3 mr-1.5 text-primary" />
                      {suggestion.text}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-foreground" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-lg p-3 flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Analyse en cours...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex space-x-2 pt-4 flex-shrink-0">
          <Input
            placeholder="Posez une question sur vos données..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="bg-gradient-primary hover:opacity-90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
