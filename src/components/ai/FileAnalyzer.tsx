import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, Loader2, Send, X, FileText, AlertTriangle, CheckCircle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";
import ReactMarkdown from "react-markdown";
import { buildJsonHeaders } from "@/lib/auth-headers";

export const FileAnalyzer = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([]);
  const [autoAnalysisDone, setAutoAnalysisDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFileData(null);
    setFileName(null);
    setConversation([]);
    setAutoAnalysisDone(false);

    try {
      const data = await parseFile(file);
      setFileData(data);
      setFileName(file.name);
      toast({
        title: "Fichier chargé",
        description: `${file.name} - ${data.length} lignes extraites`,
      });

      // Auto-launch deep analysis
      await autoAnalyze(data, file.name);
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

  const autoAnalyze = async (data: any[], name: string) => {
    setIsAnalyzing(true);
    setConversation([{ role: "user", content: `📂 Fichier importé: ${name} (${data.length} lignes)\n\nAnalyse automatique lancée...` }]);

    try {
      const analyzeHeaders = await buildJsonHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: analyzeHeaders,
        body: JSON.stringify({
          action: "analyze-file",
          fileData: data.slice(0, 200),
          prompt: `Analyse complète et approfondie de ce fichier comptable. Extrais les vraies données, détecte TOUTES les erreurs, écarts, gaps et anomalies. Propose des solutions et corrections pour chaque problème. Donne des recommandations professionnelles.`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${response.status}`);
      }

      await handleStreamResponse(response);
      setAutoAnalysisDone(true);
    } catch (error: any) {
      console.error("Auto-analysis error:", error);
      setConversation(prev => [...prev, { 
        role: "assistant", 
        content: `❌ Erreur d'analyse automatique: ${error.message}. Posez une question manuellement.` 
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStreamResponse = async (response: Response) => {
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

    if (!fullResponse) {
      setConversation(prev => [...prev, { 
        role: "assistant", 
        content: "Analyse terminée. Posez une question pour plus de détails." 
      }]);
    }
  };

  const parseFile = async (file: File): Promise<any[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'csv') return parseCsv(file);
    else if (extension === 'xlsx' || extension === 'xls') return parseExcel(file);
    else if (extension === 'pdf') return parsePdf(file);
    else throw new Error("Format non supporté. Utilisez .xlsx, .xls, .csv ou .pdf");
  };

  const parseCsv = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length === 0) { resolve([]); return; }
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
          const data = lines.slice(1).map((line, idx) => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            const row: any = { _ligne: idx + 2 };
            headers.forEach((h, i) => { row[h] = values[i] || ''; });
            return row;
          });
          resolve(data);
        } catch (error) { reject(new Error("Erreur de parsing CSV")); }
      };
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
      reader.readAsText(file);
    });
  };

  const parseExcel = async (file: File): Promise<any[]> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error("Aucune feuille trouvée");
      const jsonData: any[] = [];
      const headers: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell) => { headers.push(String(cell.value || '')); });
        } else {
          const rowData: any = { _ligne: rowNumber };
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1] || `col${colNumber}`;
            rowData[header] = cell.value;
          });
          jsonData.push(rowData);
        }
      });
      return jsonData;
    } catch (error) {
      console.error("Excel parsing error:", error);
      throw new Error("Erreur de parsing Excel. Vérifiez le format du fichier.");
    }
  };

  const parsePdf = async (file: File): Promise<any[]> => {
    try {
      const base64 = await fileToBase64(file);
      const headers = await buildJsonHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "extract-pdf", pdfBase64: base64, fileName: file.name }),
      });
      if (!response.ok) throw new Error("Échec de l'extraction PDF");
      const result = await response.json();
      return [{ content: result.text || "Contenu extrait du PDF", source: file.name }];
    } catch (error) {
      return [{ content: `Fichier PDF: ${file.name}`, note: "Extraction automatique non disponible - décrivez le contenu" }];
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
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
      const analyzeHeaders = await buildJsonHeaders();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-accountant`, {
        method: "POST",
        headers: analyzeHeaders,
        body: JSON.stringify({
          action: "analyze-file",
          fileData: fileData.slice(0, 200),
          prompt: userQuestion,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur ${response.status}`);
      }

      await handleStreamResponse(response);
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
    setAutoAnalysisDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="card-modern">
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <span>Analyseur de Fichiers</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Audit auto
            </Badge>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={clearFile}>
                <X className="h-4 w-4 mr-1" />
                Effacer
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fileData ? (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 sm:p-8 text-center hover:border-primary/50 transition-colors cursor-pointer touch-manipulation"
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
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Chargement et analyse...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Glissez ou cliquez pour uploader</p>
                  <p className="text-xs text-muted-foreground">L'analyse IA démarre automatiquement</p>
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
              <div className="flex items-center space-x-2 min-w-0">
                <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium truncate">{fileName}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary">{fileData.length} lignes</Badge>
                {autoAnalysisDone && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Analysé
                  </Badge>
                )}
              </div>
            </div>

            {/* Data Preview - Collapsed */}
            <details className="group">
              <summary className="text-xs text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                📋 Aperçu des données brutes
              </summary>
              <ScrollArea className="h-32 rounded-lg border bg-muted/30 p-2 mt-2">
                <pre className="text-xs">
                  {JSON.stringify(fileData.slice(0, 3), null, 2)}
                  {fileData.length > 3 && `\n... et ${fileData.length - 3} autres lignes`}
                </pre>
              </ScrollArea>
            </details>

            {/* Conversation - Main area */}
            {conversation.length > 0 && (
              <ScrollArea className="h-[300px] sm:h-[400px] rounded-lg border bg-muted/20 p-3 sm:p-4">
                <div className="space-y-4">
                  {conversation.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[90%] sm:max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isAnalyzing && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Analyse en cours...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Question Input */}
            <div className="flex space-x-2">
              <Textarea
                placeholder="Posez une question sur vos données... (ex: Quels sont les écarts de TVA? Détecte les erreurs de calcul)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
                className="flex-1 min-h-[60px] sm:min-h-[80px] text-sm"
              />
              <Button 
                onClick={askQuestion} 
                disabled={isAnalyzing || !question.trim()}
                className="bg-gradient-primary hover:opacity-90 self-end"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Quick audit questions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setQuestion("Détecte toutes les erreurs et anomalies dans ce fichier")}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Erreurs
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setQuestion("Calcule les écarts débit/crédit et la balance")}>
                Écarts
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setQuestion("Vérifie la conformité TVA et les calculs HT/TTC")}>
                TVA
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setQuestion("Propose des corrections et écritures de régularisation")}>
                <Lightbulb className="h-3 w-3 mr-1" />
                Solutions
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8"
                onClick={() => setQuestion("Calcule les ratios financiers: solvabilité, liquidité, BFR")}>
                Ratios
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
