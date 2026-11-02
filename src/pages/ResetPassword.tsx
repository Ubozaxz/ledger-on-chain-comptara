import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast({ title: 'Minimum 6 caractères', variant: 'destructive' });
    if (password !== confirm) return toast({ title: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    toast({ title: 'Mot de passe mis à jour' });
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-20">
      <Card className="w-full max-w-md card-modern">
        <CardHeader><CardTitle className="text-xl text-gradient text-center">Nouveau mot de passe</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">Nouveau mot de passe</Label>
              <Input id="np" type="password" autoComplete="new-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Confirmer</Label>
              <Input id="cp" type="password" autoComplete="new-password" className="h-11" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full h-12 bg-gradient-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
