import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Smartphone, Check, Share, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone;
    setIsInstalled(!!isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-modern">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Smartphone className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gradient">Installer Comptara</CardTitle>
          <p className="text-sm text-muted-foreground">
            Installez l'application sur votre téléphone pour un accès rapide, même hors connexion.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-success/20 rounded-full flex items-center justify-center">
                  <Check className="h-8 w-8 text-success" />
                </div>
              </div>
              <p className="text-sm font-medium text-success">Application déjà installée !</p>
              <Button onClick={() => navigate('/')} className="w-full bg-gradient-primary">
                Ouvrir l'application
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-center">Installation sur iPhone/iPad :</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground mt-0.5">1</Badge>
                  <div>
                    <p className="text-sm font-medium">Appuyez sur le bouton Partager</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Share className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">en bas de Safari</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground mt-0.5">2</Badge>
                  <div>
                    <p className="text-sm font-medium">«&nbsp;Sur l'écran d'accueil&nbsp;»</p>
                    <p className="text-xs text-muted-foreground">Faites défiler et sélectionnez cette option</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground mt-0.5">3</Badge>
                  <div>
                    <p className="text-sm font-medium">Appuyez «&nbsp;Ajouter&nbsp;»</p>
                    <p className="text-xs text-muted-foreground">L'icône Comptara apparaîtra sur votre écran d'accueil</p>
                  </div>
                </div>
              </div>
            </div>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <Button onClick={handleInstall} className="w-full h-14 bg-gradient-primary hover:opacity-90 text-lg">
                <Download className="h-5 w-5 mr-2" />
                Installer maintenant
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Gratuit • Pas besoin du Play Store
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-center">Installation sur Android :</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground mt-0.5">1</Badge>
                  <div>
                    <p className="text-sm font-medium">Menu du navigateur</p>
                    <p className="text-xs text-muted-foreground">Appuyez sur ⋮ en haut à droite de Chrome</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge className="bg-primary text-primary-foreground mt-0.5">2</Badge>
                  <div>
                    <p className="text-sm font-medium">«&nbsp;Installer l'application&nbsp;»</p>
                    <p className="text-xs text-muted-foreground">ou «&nbsp;Ajouter à l'écran d'accueil&nbsp;»</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features list */}
          <div className="border-t border-border/50 pt-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avantages</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success flex-shrink-0" />
                Accès rapide depuis l'écran d'accueil
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success flex-shrink-0" />
                Fonctionne hors connexion
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success flex-shrink-0" />
                Expérience plein écran (sans barre URL)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success flex-shrink-0" />
                Notifications push (bientôt)
              </li>
            </ul>
          </div>

          <Button variant="ghost" onClick={() => navigate('/')} className="w-full text-sm">
            Continuer sans installer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;