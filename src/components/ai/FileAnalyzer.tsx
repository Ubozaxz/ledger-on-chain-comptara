import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, Loader2, Send, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export const FileAnalyzer = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFileData(null);
    setFileName(null);
    setConversation([]);

    try {
      const data = await parseFile(file);
      setFileData(data);
      setFileName(file.name);
      toast({
        title: "Fichier chargé",
        description: `${file.name} - ${data.length} lignes`,
      });
    } catch (error: any) {
      console.error("File parsing error:", error);
      toast({
        title: "Erreur de lecture",
        description: error.message || "Impossible de lire le fichier",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const parseFile = async (file: File): Promise<any[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      return parseCsv(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      return parseExcel(file);
    } else if (extension === 'pdf') {
      return parsePdf(file);
    } else {
      throw new Error("Format non supporté. Utilisez .xlsx, .xls, .csv ou .pdf");
    }
  };

  const parseCsv = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length === 0) {
            resolve([]);
            return;
          }
          
          // Handle different delimiters
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
          
          const data = lines.slice(1).map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((h, i) => {
              row[h] = values[i] || '';
            });
            return row;
          });
          
          resolve(data);
        } catch (error) {
          reject(new Error("Erreur de parsing CSV"));
        }
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsText(file);
    });
  };

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          // Use ArrayBuffer instead of BinaryString for better mobile compatibility
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData as any[]);
        } catch (error) {
          console.error("Excel parsing error:", error);
          reject(new Error("Erreur de parsing Excel. Vérifiez le format du fichier."));
        }
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsArrayBuffer(file); // Changed from readAsBinaryString for iOS compatibility
    });
  };

  const parsePdf = async (file: File): Promise<any[]> => {
    // For PDF, we'll extract text content via backend
    try {
      const base64 = await fileToBase64(file);
      
      const { buildJsonHeaders } = await import('@/lib/auth-headers');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: await buildJsonHeaders(),
        body: JSON.stringify({
          action: "extract-pdf",
          pdfBase64: base64,
          fileName: file.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Échec de l'extraction PDF");
      }

      const result = await response.json();
      
      // Return extracted text as a single-row dataset for analysis
      return [{ content: result.text || "Contenu extrait du PDF", source: file.name }];
    } catch (error) {
      console.error("PDF parsing error:", error);
      // Fallback: create a simple entry with file info
      return [{ content: `Fichier PDF: ${file.name}`, note: "Extraction automatique non disponible - décrivez le contenu manuellement" }];
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const askQuestion = async () => {
    if (!question.trim() || !fileData) return;

    const userQuestion = question;
    setQuestion("");
    setConversation(prev => [...prev, { role: "user", content: userQuestion }]);
    setIsAnalyzing(true);

    try {
      const { buildJsonHeaders } = await import('@/lib/auth-headers');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: await buildJsonHeaders(),
        body: JSON.stringify({
          action: "analyze-file",
          fileData: fileData.slice(0, 100), // Limit to first 100 rows
          prompt: userQuestion,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${response.status}`);
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
                if (content) {
                  fullResponse += content;
                  // Update last assistant message in real-time
                  setConversation(prev => {
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

      // If no streaming content was received, show error
      if (!fullResponse) {
        setConversation(prev => [...prev, { 
          role: "assistant", 
          content: "Analyse terminée. Posez une autre question pour plus de détails." 
        }]);
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      setConversation(prev => [...prev, { 
        role: "assistant", 
        content: `Erreur: ${error.message || "Impossible d'analyser le fichier"}` 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFile = () => {
    setFileData(null);
    setFileName(null);
    setConversation([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span>Analyseur de Fichiers</span>
          </div>
          {fileName && (
            <Button variant="ghost" size="sm" onClick={clearFile}>
              <X className="h-4 w-4 mr-1" />
              Effacer
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fileData ? (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer touch-manipulation"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              {isUploading ? (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Glissez ou cliquez pour uploader</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      Excel
                    </Badge>
                    <Badge variant="outline" className="text-xs">CSV</Badge>
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      PDF
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
              </div>
              <Badge variant="secondary">{fileData.length} lignes</Badge>
            </div>

            {/* Data Preview */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Aperçu des données</p>
              <ScrollArea className="h-32 rounded-lg border bg-muted/30 p-2">
                <pre className="text-xs">
                  {JSON.stringify(fileData.slice(0, 3), null, 2)}
                  {fileData.length > 3 && `\n... et ${fileData.length - 3} autres lignes`}
                </pre>
              </ScrollArea>
            </div>

            {/* Conversation */}
            {conversation.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border bg-muted/20 p-4">
                <div className="space-y-4">
                  {conversation.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Question Input */}
            <div className="flex space-x-2">
              <Textarea
                placeholder="Posez une question sur vos données... (ex: Quel est mon profit net après taxes?)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
                className="flex-1 min-h-[80px]"
              />
              <Button 
                onClick={askQuestion} 
                disabled={isAnalyzing || !question.trim()}
                className="bg-gradient-primary hover:opacity-90"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Example Questions */}
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuestion("Quel est mon profit net après taxes selon ces données?")}
              >
                Profit net
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuestion("Calcule mon ratio de solvabilité")}
              >
                Ratio solvabilité
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setQuestion("Propose des optimisations fiscales")}
              >
                Optimisations fiscales
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
