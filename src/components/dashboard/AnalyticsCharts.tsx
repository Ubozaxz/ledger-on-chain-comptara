import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";

interface AnalyticsChartsProps {
  entries: any[];
  payments: any[];
}

const COLORS = ['hsl(217.2, 91.2%, 59.8%)', 'hsl(262.1, 83.3%, 57.8%)', 'hsl(142.1, 76.2%, 36.3%)', 'hsl(32.2, 95%, 44.1%)'];

export function AnalyticsCharts({ entries, payments }: AnalyticsChartsProps) {
  // Prepare data for charts
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        fullDate: date.toISOString().split('T')[0]
      });
    }
    return days;
  };

  const last7Days = getLast7Days();

  // Calculate daily volumes
  const dailyData = last7Days.map(day => {
    const dayEntries = entries.filter(e => {
      const entryDate = new Date(e.created_at || e.date).toISOString().split('T')[0];
      return entryDate === day.fullDate;
    });
    const dayPayments = payments.filter(p => {
      const paymentDate = new Date(p.created_at).toISOString().split('T')[0];
      return paymentDate === day.fullDate;
    });

    const entriesAmount = dayEntries.reduce((sum, e) => sum + (parseFloat(e.montant) || 0), 0);
    const paymentsAmount = dayPayments.reduce((sum, p) => sum + (parseFloat(p.montant) || 0), 0);

    return {
      name: day.date,
      écritures: entriesAmount,
      paiements: paymentsAmount,
      total: entriesAmount + paymentsAmount
    };
  });

  // Category distribution
  const categoryData = entries.reduce((acc, entry) => {
    const category = entry.debit || entry.credit || 'Divers';
    const existing = acc.find((c: any) => c.name === category);
    if (existing) {
      existing.value += parseFloat(entry.montant) || 0;
    } else {
      acc.push({ name: category, value: parseFloat(entry.montant) || 0 });
    }
    return acc;
  }, [] as { name: string; value: number }[]).slice(0, 4);

  // Transaction type distribution
  const transactionTypeData = [
    { name: 'Écritures', value: entries.length, amount: entries.reduce((s, e) => s + (parseFloat(e.montant) || 0), 0) },
    { name: 'Paiements', value: payments.filter(p => p.type === 'paiement').length, amount: payments.filter(p => p.type === 'paiement').reduce((s, p) => s + (parseFloat(p.montant) || 0), 0) },
    { name: 'Encaissements', value: payments.filter(p => p.type === 'encaissement').length, amount: payments.filter(p => p.type === 'encaissement').reduce((s, p) => s + (parseFloat(p.montant) || 0), 0) }
  ];

  const totalVolume = entries.reduce((s, e) => s + (parseFloat(e.montant) || 0), 0) + 
                      payments.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {/* Volume Chart */}
      <Card className="card-modern col-span-1 lg:col-span-2">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <span>Volume sur 7 jours</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <div className="h-[200px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217.2, 91.2%, 59.8%)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(217.2, 91.2%, 59.8%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(217.2, 91.2%, 59.8%)" 
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                  name="Total HBAR"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Types */}
      <Card className="card-modern">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
            <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <span>Types de transactions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <div className="h-[180px] md:h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionTypeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 10 }}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="value" fill="hsl(217.2, 91.2%, 59.8%)" radius={[4, 4, 0, 0]} name="Nombre" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card className="card-modern">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center space-x-2 text-base md:text-lg">
            <PieChartIcon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <span>Répartition par catégorie</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {categoryData.length > 0 ? (
            <div className="h-[180px] md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)} HBAR`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] md:h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Aucune donnée disponible
            </div>
          )}
          {categoryData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categoryData.map((cat, index) => (
                <div key={cat.name} className="flex items-center space-x-2 text-xs">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{cat.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="card-modern col-span-1 lg:col-span-2">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 md:p-4 bg-primary/10 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-primary">{entries.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Écritures</p>
            </div>
            <div className="text-center p-3 md:p-4 bg-success/10 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-success">{payments.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Transactions</p>
            </div>
            <div className="text-center p-3 md:p-4 bg-warning/10 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-warning">{totalVolume.toFixed(2)}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Volume HBAR</p>
            </div>
            <div className="text-center p-3 md:p-4 bg-muted rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-foreground">100%</p>
              <p className="text-xs md:text-sm text-muted-foreground">On-chain</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
