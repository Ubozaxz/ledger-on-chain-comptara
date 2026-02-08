import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  Users, FileText, CreditCard, BarChart3, RefreshCw, 
  LogOut, Shield, TrendingUp, ArrowLeft, Loader2,
  Activity, PieChart, Calendar, Hash, Wallet, Database,
  CheckCircle, AlertTriangle, Clock, Globe, Percent,
  Download, Settings, Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminStats {
  totalUsers: number;
  totalEntries: number;
  totalPayments: number;
  totalVolume: number;
  activeUsers: number;
  todayTransactions: number;
  verifiedTransactions: number;
  avgTransactionValue: number;
  totalTVA: number;
  tvaEntriesCount: number;
}

interface UserData {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  display_name: string | null;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
}

interface EntryData {
  id: string;
  libelle: string;
  montant: number;
  devise: string;
  wallet_address: string;
  created_at: string;
  tx_hash: string | null;
  user_id: string | null;
  category: string | null;
  tva_rate: number | null;
  montant_ht: number | null;
  montant_tva: number | null;
}

interface PaymentData {
  id: string;
  objet: string;
  montant: number;
  devise: string;
  type: string;
  wallet_address: string;
  created_at: string;
  tx_hash: string;
  status: string | null;
}

export default function Admin() {
  const { user, profile, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalEntries: 0, totalPayments: 0, totalVolume: 0,
    activeUsers: 0, todayTransactions: 0, verifiedTransactions: 0, avgTransactionValue: 0,
    totalTVA: 0, tvaEntriesCount: 0
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
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
      // Fetch all profiles via secure view (excludes email for privacy)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles_public')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setUsers(profilesData || []);

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (!rolesError && rolesData) {
        setUserRoles(rolesData as UserRole[]);
      }

      // Fetch all entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('accounting_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (entriesError) throw entriesError;
      setEntries(entriesData || []);

      // Fetch all payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Calculate comprehensive stats
      const entriesVolume = (entriesData || []).reduce((sum, e) => sum + (e.montant || 0), 0);
      const paymentsVolume = (paymentsData || []).reduce((sum, p) => sum + (p.montant || 0), 0);
      const totalVolume = entriesVolume + paymentsVolume;
      const totalTransactions = (entriesData?.length || 0) + (paymentsData?.length || 0);

      // Today's transactions
      const today = new Date().toISOString().split('T')[0];
      const todayEntries = (entriesData || []).filter(e => e.created_at.startsWith(today)).length;
      const todayPayments = (paymentsData || []).filter(p => p.created_at.startsWith(today)).length;

      // Verified transactions (with tx_hash)
      const verifiedEntries = (entriesData || []).filter(e => e.tx_hash && e.tx_hash.length > 10).length;
      const verifiedPayments = (paymentsData || []).filter(p => p.tx_hash && p.tx_hash.length > 10).length;

      // Active users (with at least one transaction)
      const activeUserIds = new Set([
        ...(entriesData || []).filter(e => e.user_id).map(e => e.user_id),
        ...(paymentsData || []).filter(p => p.user_id).map(p => p.user_id)
      ]);

      // TVA stats
      const entriesWithTVA = (entriesData || []).filter(e => e.tva_rate !== null);
      const totalTVA = entriesWithTVA.reduce((sum, e) => sum + (e.montant_tva || 0), 0);

      setStats({
        totalUsers: (profilesData || []).length,
        totalEntries: (entriesData || []).length,
        totalPayments: (paymentsData || []).length,
        totalVolume,
        activeUsers: activeUserIds.size,
        todayTransactions: todayEntries + todayPayments,
        verifiedTransactions: verifiedEntries + verifiedPayments,
        avgTransactionValue: totalTransactions > 0 ? totalVolume / totalTransactions : 0,
        totalTVA,
        tvaEntriesCount: entriesWithTVA.length
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

  const getVerificationRate = () => {
    const total = stats.totalEntries + stats.totalPayments;
    if (total === 0) return 0;
    return (stats.verifiedTransactions / total) * 100;
  };

  const getUserRole = (userId: string): string => {
    const role = userRoles.find(r => r.user_id === userId);
    return role?.role || 'user';
  };

  const exportData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      stats,
      users: users.map(u => ({ ...u, role: getUserRole(u.id) })),
      entries,
      payments
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comptara_admin_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Export réussi', description: 'Données exportées en JSON' });
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-20 safe-area-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gradient">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Gestion de la plateforme</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="hidden sm:flex bg-primary/10 text-primary border-primary/20 text-xs">
              {profile?.email}
            </Badge>
            <Button variant="ghost" size="icon" onClick={exportData} className="h-9 w-9">
              <Download className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Overview Stats - Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="card-modern">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Utilisateurs</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-success">{stats.activeUsers} actifs</p>
                </div>
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Écritures</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalEntries}</p>
                  <p className="text-xs text-muted-foreground">comptables</p>
                </div>
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Paiements</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalPayments}</p>
                  <p className="text-xs text-muted-foreground">confirmés</p>
                </div>
                <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-modern">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Volume Total</p>
                  <p className="text-lg sm:text-xl font-bold">{stats.totalVolume.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">HBAR</p>
                </div>
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats - Row 2 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="card-modern bg-muted/30">
            <CardContent className="p-3 flex items-center space-x-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{stats.todayTransactions}</p>
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-muted/30">
            <CardContent className="p-3 flex items-center space-x-3">
              <Hash className="h-5 w-5 text-success" />
              <div>
                <p className="text-lg font-bold">{stats.verifiedTransactions}</p>
                <p className="text-xs text-muted-foreground">On-chain</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-muted/30">
            <CardContent className="p-3 flex items-center space-x-3">
              <Activity className="h-5 w-5 text-warning" />
              <div>
                <p className="text-lg font-bold">{stats.avgTransactionValue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Moy. HBAR</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-muted/30">
            <CardContent className="p-3 flex items-center space-x-3">
              <Percent className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{stats.totalTVA.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">TVA Total</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern bg-muted/30 col-span-2 md:col-span-1">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vérification</span>
                <span className="text-xs font-medium">{getVerificationRate().toFixed(0)}%</span>
              </div>
              <Progress value={getVerificationRate()} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-success" />
            <span className="text-xs text-muted-foreground">Hedera Testnet • {stats.tvaEntriesCount} écritures avec TVA</span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchAdminData}
            disabled={isLoading}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Data Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </TabsTrigger>
            <TabsTrigger value="entries" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Écritures</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Paiements</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Tous les utilisateurs ({users.length})</span>
                  </div>
                  <Badge variant="outline">{stats.activeUsers} actifs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px] sm:h-[400px]">
                  <div className="space-y-2">
                    {users.map((userData) => {
                      const role = getUserRole(userData.user_id);
                      return (
                        <div key={userData.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-primary">
                                {(userData.display_name || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{userData.display_name || `User ${userData.user_id.slice(0, 8)}`}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {new Date(userData.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={role === 'admin' ? 'default' : 'outline'}
                            className={role === 'admin' ? 'bg-primary/20 text-primary flex-shrink-0' : 'flex-shrink-0'}
                          >
                            {role}
                          </Badge>
                        </div>
                      );
                    })}
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-success" />
                    <span>Dernières écritures ({entries.length})</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Percent className="h-3 w-3 mr-1" />
                    {stats.tvaEntriesCount} avec TVA
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px] sm:h-[400px]">
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm truncate">{entry.libelle}</p>
                            {entry.tx_hash && (
                              <CheckCircle className="h-3 w-3 text-success flex-shrink-0" />
                            )}
                            {entry.tva_rate !== null && (
                              <Badge variant="outline" className="text-xs h-5 flex-shrink-0">
                                TVA {entry.tva_rate}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Wallet className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {entry.wallet_address?.slice(0, 10)}...
                            </p>
                            {entry.category && (
                              <Badge variant="outline" className="text-xs h-5">
                                {entry.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-semibold text-sm">{entry.montant} {entry.devise}</p>
                          {entry.montant_tva !== null && (
                            <p className="text-xs text-muted-foreground">TVA: {entry.montant_tva}</p>
                          )}
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
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-warning" />
                    <span>Derniers paiements ({payments.length})</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px] sm:h-[400px]">
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm truncate">{payment.objet || payment.type}</p>
                            <Badge 
                              variant={payment.status === 'confirmed' ? 'default' : 'secondary'}
                              className={`text-xs h-5 flex-shrink-0 ${payment.status === 'confirmed' ? 'bg-success/20 text-success' : ''}`}
                            >
                              {payment.status || 'pending'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Hash className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {payment.tx_hash?.slice(0, 16)}...
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-semibold text-sm">{payment.montant} {payment.devise}</p>
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
        
        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          designed by <span className="font-medium text-primary">promé</span>
        </p>
      </main>
    </div>
  );
}