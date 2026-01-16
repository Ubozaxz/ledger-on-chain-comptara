import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  Users, FileText, CreditCard, BarChart3, RefreshCw, 
  LogOut, Shield, TrendingUp, ArrowLeft, Loader2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminStats {
  totalUsers: number;
  totalEntries: number;
  totalPayments: number;
  totalVolume: number;
}

interface UserData {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface EntryData {
  id: string;
  libelle: string;
  montant: number;
  devise: string;
  wallet_address: string;
  created_at: string;
}

interface PaymentData {
  id: string;
  objet: string;
  montant: number;
  devise: string;
  type: string;
  wallet_address: string;
  created_at: string;
}

export default function Admin() {
  const { user, profile, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalEntries: 0, totalPayments: 0, totalVolume: 0 });
  const [users, setUsers] = useState<UserData[]>([]);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        toast({
          title: 'Accès refusé',
          description: 'Vous n\'avez pas les droits d\'administrateur',
          variant: 'destructive'
        });
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, navigate, toast]);

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      // Fetch all profiles (users)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setUsers(profilesData || []);

      // Fetch all entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('accounting_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Fetch all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Calculate stats
      const entriesVolume = (entriesData || []).reduce((sum, e) => sum + (e.montant || 0), 0);
      const paymentsVolume = (paymentsData || []).reduce((sum, p) => sum + (p.montant || 0), 0);

      setStats({
        totalUsers: (profilesData || []).length,
        totalEntries: (entriesData || []).length,
        totalPayments: (paymentsData || []).length,
        totalVolume: entriesVolume + paymentsVolume
      });

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données admin',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading || (!isAdmin && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50 safe-area-top">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-gradient">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="default" className="bg-primary/20 text-primary">
              {profile?.email}
            </Badge>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="card-modern">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Utilisateurs</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Écritures</p>
                  <p className="text-2xl font-bold">{stats.totalEntries}</p>
                </div>
                <FileText className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Paiements</p>
                  <p className="text-2xl font-bold">{stats.totalPayments}</p>
                </div>
                <CreditCard className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="text-xl font-bold">{stats.totalVolume.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={fetchAdminData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Data Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="entries">
              <FileText className="h-4 w-4 mr-2" />
              Écritures
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Paiements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span>Tous les utilisateurs ({users.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{user.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun utilisateur trouvé
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entries">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-success" />
                  <span>Dernières écritures ({entries.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{entry.libelle}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {entry.wallet_address?.slice(0, 12)}...
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{entry.montant} {entry.devise}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {entries.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucune écriture trouvée
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-warning" />
                  <span>Derniers paiements ({payments.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{payment.objet}</p>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {payment.type}
                            </Badge>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {payment.wallet_address?.slice(0, 12)}...
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{payment.montant} {payment.devise}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {payments.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun paiement trouvé
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
