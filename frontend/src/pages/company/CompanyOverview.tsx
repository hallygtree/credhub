import { useQuery } from '@tanstack/react-query';
import { getCompanyOverview } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { ActivityCalendar } from '@/components/ui/activity-calendar';
import { formatCurrency } from '@/lib/utils';
import { Users, Wallet, TrendingUp } from 'lucide-react';

export function CompanyOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['company-overview'],
    queryFn: getCompanyOverview,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-green-dark border-t-transparent"></div>
      </div>
    );
  }

  const company = data?.data?.company;
  const stats = data?.data?.stats;
  const transactions = data?.data?.transactions || [];

  const totalDeposits = transactions.filter((t: { type: string }) => t.type === 'DEPOSIT').length;
  const totalBalance = transactions
    .filter((t: { type: string }) => t.type === 'DEPOSIT')
    .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-green-dark">{company?.name}</h1>
        <p className="text-brand-green-light mt-1">Painel da empresa</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="group hover:border-brand-green-light transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Colaboradores Ativos</p>
                <p className="text-2xl font-bold text-brand-green-dark">{stats?.totalEmployees || 0}</p>
                <p className="text-sm text-brand-green-light mt-1">inscritos no programa</p>
              </div>
              <div className="p-2 rounded-lg bg-brand-terracotta/10 text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-white transition-colors">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Volume de Recargas</p>
                <p className="text-2xl font-bold text-brand-green-dark">{formatCurrency(totalBalance)}</p>
                <p className="text-sm text-brand-green-light mt-1">total depositado</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Total de Recargas</p>
                <p className="text-2xl font-bold text-brand-green-dark">{totalDeposits}</p>
                <p className="text-sm text-brand-green-light mt-1">depositos realizados</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-brand-green-dark mb-4">Historico de Recargas</h2>
        <ActivityCalendar transactions={transactions} />
      </div>
    </div>
  );
}
