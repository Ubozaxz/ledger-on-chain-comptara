import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import comptaraLogo from '@/assets/comptara-logo.jpg';
import { z } from 'zod';
import { lovable } from '@/integrations/lovable/index';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { signIn, signUp, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    try {
      emailSchema.parse(email.trim());
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setIsLoading(false);

    if (error) {
      let message = 'Erreur de connexion';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou mot de passe incorrect';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Veuillez confirmer votre email (vérifiez vos spams), ou renvoyez le lien.';
        setNeedsConfirm(true);
      } else if (/rate limit|too many/i.test(error.message)) {
        message = 'Trop de tentatives, réessayez dans quelques minutes';
      } else if (/fetch|network/i.test(error.message)) {
        message = 'Pas de connexion internet';
      }
      toast({
        title: 'Échec de la connexion',
        description: message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Connexion réussie',
        description: 'Bienvenue sur Comptara!'
      });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password);
    setIsLoading(false);

    if (error) {
      let message = 'Erreur lors de l\'inscription';
      if (/already registered|already been registered/i.test(error.message)) {
        message = 'Cet email est déjà utilisé : connectez-vous ou utilisez Google';
      } else if (/password/i.test(error.message) && /(weak|pwned|leaked|should be|known)/i.test(error.message)) {
        message = 'Mot de passe trop faible ou trop courant, choisissez-en un autre';
      } else if (/rate limit/i.test(error.message)) {
        message = 'Trop de tentatives, réessayez dans quelques minutes';
      } else {
        message = error.message;
      }
      toast({
        title: 'Échec de l\'inscription',
        description: message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Inscription réussie',
        description: 'Un lien de confirmation a été envoyé. Vérifiez votre boîte mail (et les spams).'
      });
      setNeedsConfirm(true);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: window.location.origin } });
    toast(error ? { title: 'Erreur', description: error.message, variant: 'destructive' } : { title: 'Lien renvoyé', description: 'Vérifiez votre boîte mail' });
  };

  const handleForgot = async () => {
    try { emailSchema.parse(email.trim()); } catch { setErrors({ email: 'Saisissez votre email ci-dessus' }); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
    toast(error ? { title: 'Erreur', description: error.message, variant: 'destructive' } : { title: 'Email envoyé', description: 'Suivez le lien reçu pour choisir un nouveau mot de passe' });
  };

  const handleGoogle = async () => {
    setIsLoading(true);
    let result: any;
    try {
      result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin, extraParams: { prompt: 'select_account' } });
    } catch (e: any) {
      result = { error: e };
    }
    if (result?.error) {
      setIsLoading(false);
      const msg = String(result.error?.message || '');
      toast({
        title: 'Connexion Google interrompue',
        description: /popup|closed|cancel/i.test(msg) ? 'Fenêtre fermée. Autorisez les pop-ups et réessayez.' : (msg || 'Réessayez dans un instant'),
        variant: 'destructive',
      });
      return;
    }
    if (result.redirected) return;
    setIsLoading(false);
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-20 safe-area-top">
      <Card className="w-full max-w-md card-modern relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="flex justify-center">
            <img src={comptaraLogo} alt="Comptara" className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-1 ring-primary/30" />
          </div>
          <div>
            <CardTitle className="text-2xl text-gradient">Comptara</CardTitle>
            <CardDescription className="mt-2">
              Comptabilité blockchain sécurisée sur Hedera
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Button type="button" variant="outline" className="w-full h-12 text-base touch-manipulation" onClick={handleGoogle} disabled={isLoading}>
            <svg className="h-5 w-5 mr-2" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continuer avec Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />ou avec email<div className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="signin" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="text-sm">
                <LogIn className="h-4 w-4 mr-2" />
                Connexion
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Inscription
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-11 h-11"
                      required
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-muted-foreground" aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Se connecter
                    </>
                  )}
                </Button>
                <button type="button" onClick={handleForgot} className="w-full text-center text-sm text-primary hover:underline">
                  Mot de passe oublié ?
                </button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-11 h-11"
                      required
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-muted-foreground" aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Minimum 6 caractères
                  </p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:opacity-90 h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5 mr-2" />
                      Créer un compte
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          {needsConfirm && (
            <Button type="button" variant="ghost" className="w-full text-sm" onClick={handleResend}>
              Renvoyer l'email de confirmation
            </Button>
          )}
          
          <p className="text-center text-xs text-muted-foreground pt-4">
            designed by <span className="font-medium text-primary">promé</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}