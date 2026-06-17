import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminOverview, getAllTransactions, searchByCardNumber, registerPurchaseByCard, exportTransactionsCsv } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActivityCalendar } from '@/components/ui/activity-calendar';
import { formatCurrency, parseBrazilianNumber } from '@/lib/utils';
import { Building2, Users, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, ShoppingCart, Loader2, Search, MinusCircle, User, Download } from 'lucide-react';
import { toast } from 'sonner';

interface CardHolder {
  id: string;
  type: 'EMPLOYEE' | 'CPF_USER';
  name: string;
  balance: number;
  cardNumber: string;
  companyName?: string;
}

type SubscribersView = 'all' | 'employees' | 'cpf_users';

export function AdminOverview() {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CardHolder[]>([]);
  const [selectedHolder, setSelectedHolder] = useState<CardHolder | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDescription, setPurchaseDescription] = useState('');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [subscribersView, setSubscribersView] = useState<SubscribersView>('all');
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await exportTransactionsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacoes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['admin-all-transactions'],
    queryFn: () => getAllTransactions(1, 200),
  });

  const { deposits, consumes } = useMemo(() => {
    const txs = transactionsData?.data?.transactions || [];
    const deps = txs.filter((t: { amount: number; type: string }) =>
      t.amount > 0 || t.type === 'CREDIT_RESET' || t.type === 'DEPOSIT'
    );
    const cons = txs.filter((t: { amount: number; type: string }) =>
      t.amount < 0 || t.type === 'CONSUME'
    );
    return { deposits: deps, consumes: cons };
  }, [transactionsData]);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await searchByCardNumber(searchTerm.trim());
        setSearchResults(response?.data?.holders || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const purchaseMutation = useMutation({
    mutationFn: registerPurchaseByCard,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
      // Update the selected holder's balance in the UI
      if (response?.data?.holder) {
        setSelectedHolder(response.data.holder);
      }
      setPurchaseAmount('');
      setPurchaseDescription('');
      setPurchaseError(null);
      toast.success('Compra registrada com sucesso!');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      setPurchaseError(error.response?.data?.message || 'Erro ao registrar compra');
    },
  });

  const handleSelectHolder = (holder: CardHolder) => {
    setSelectedHolder(holder);
    setSearchResults([]);
  };

  const handlePurchaseSubmit = () => {
    setPurchaseError(null);

    if (!selectedHolder) return;

    const numericAmount = parseBrazilianNumber(purchaseAmount);

    if (numericAmount <= 0) {
      setPurchaseError('Digite um valor maior que zero');
      return;
    }

    if (!purchaseDescription.trim()) {
      setPurchaseError('Digite uma descricao para a compra');
      return;
    }

    if (selectedHolder.balance < numericAmount) {
      setPurchaseError('Saldo insuficiente');
      return;
    }

    purchaseMutation.mutate({
      cardNumber: selectedHolder.cardNumber,
      amount: numericAmount,
      description: purchaseDescription.trim(),
    });
  };

  const handleOpenPurchaseDialog = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedHolder(null);
    setPurchaseAmount('');
    setPurchaseDescription('');
    setPurchaseError(null);
    setIsPurchaseDialogOpen(true);
  };

  const handleClosePurchaseDialog = () => {
    setIsPurchaseDialogOpen(false);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedHolder(null);
    setPurchaseAmount('');
    setPurchaseDescription('');
    setPurchaseError(null);
  };

  const handleClearSelection = () => {
    setSelectedHolder(null);
    setSearchTerm('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-green-dark border-t-transparent"></div>
      </div>
    );
  }

  const overview = data?.data?.overview;

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-brand-green-dark">
            Painel Administrativo
          </h1>
          <p className="text-brand-green-light mt-1">
            Administração geral e registro de consumos
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar CSV
          </Button>
          <Button onClick={handleOpenPurchaseDialog} className="w-full sm:w-auto">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Registrar compra
          </Button>
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={(open) => !open && handleClosePurchaseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!selectedHolder ? (
              <>
                {/* Card Search */}
                <div className="space-y-2">
                  <Label htmlFor="card-search">Buscar por Cartao ou Nome do Comprador</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-green-light" />
                    <Input
                      id="card-search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Digite para buscar..."
                      className="pl-10"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-brand-green-light" />
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {searchResults.map((holder) => (
                      <button
                        key={`${holder.type}-${holder.id}`}
                        type="button"
                        className="w-full p-3 text-left hover:bg-brand-cream transition-colors flex items-center justify-between"
                        onClick={() => handleSelectHolder(holder)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-cream flex items-center justify-center">
                            {holder.type === 'EMPLOYEE' ? (
                              <Building2 className="h-4 w-4 text-brand-green-dark" />
                            ) : (
                              <User className="h-4 w-4 text-brand-terracotta" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-brand-green-dark">{holder.name}</p>
                            <p className="text-sm text-brand-green-light">
                              {holder.cardNumber} {holder.companyName && `- ${holder.companyName}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-brand-green-dark">{formatCurrency(holder.balance)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchTerm && !isSearching && searchResults.length === 0 && (
                  <p className="text-sm text-brand-green-light text-center py-4">
                    Nenhum comprador encontrado
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Selected Card Holder */}
                <div className="rounded-lg bg-brand-cream p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                        {selectedHolder.type === 'EMPLOYEE' ? (
                          <Building2 className="h-5 w-5 text-brand-green-dark" />
                        ) : (
                          <User className="h-5 w-5 text-brand-terracotta" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-brand-green-dark">{selectedHolder.name}</p>
                        <p className="text-sm text-brand-green-light">
                          {selectedHolder.cardNumber}
                          {selectedHolder.companyName && ` - ${selectedHolder.companyName}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-brand-green-light">Saldo</p>
                      <p className="text-xl font-bold text-brand-green-dark">
                        {formatCurrency(selectedHolder.balance)}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  className="w-full"
                >
                  Buscar outro comprador
                </Button>

                {purchaseError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {purchaseError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="purchase-amount">Valor da Compra (R$)</Label>
                  <Input
                    id="purchase-amount"
                    type="text"
                    inputMode="decimal"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    placeholder="Ex: 15,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase-description">Descricao</Label>
                  <Input
                    id="purchase-description"
                    value={purchaseDescription}
                    onChange={(e) => setPurchaseDescription(e.target.value)}
                    placeholder="Ex: Almoco, Lanche..."
                  />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={handlePurchaseSubmit}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MinusCircle className="mr-2 h-4 w-4" />
                  )}
                  Registrar compra
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleClosePurchaseDialog}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

        <Card
          className="group hover:border-brand-green-light transition-colors cursor-pointer select-none"
          onClick={() => setSubscribersView(subscribersView === 'employees' ? 'all' : 'employees')}
          onContextMenu={(e) => {
            e.preventDefault();
            setSubscribersView(subscribersView === 'cpf_users' ? 'all' : 'cpf_users');
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">
              {subscribersView === 'all' && 'Total de inscritos'}
              {subscribersView === 'employees' && 'Colaboradores'}
              {subscribersView === 'cpf_users' && 'Usuários cadastrados com CPF'}
            </CardTitle>
            <div className="p-2 rounded-lg bg-brand-terracotta/10 text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-white transition-colors">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-green-dark">
              {subscribersView === 'all' && ((overview?.totalEmployees || 0) + (overview?.totalCpfUsers || 0))}
              {subscribersView === 'employees' && (overview?.totalEmployees || 0)}
              {subscribersView === 'cpf_users' && (overview?.totalCpfUsers || 0)}
            </div>
            <p className="text-sm text-brand-green-light mt-1">
              {subscribersView === 'all' && (
                <>
                  <span className="text-emerald-600 font-medium">{(overview?.activeEmployees || 0) + (overview?.activeCpfUsers || 0)}</span> ativos
                </>
              )}
              {subscribersView === 'employees' && (
                <>
                  <span className="text-emerald-600 font-medium">{overview?.activeEmployees || 0}</span> ativos
                </>
              )}
              {subscribersView === 'cpf_users' && (
                <>
                  <span className="text-emerald-600 font-medium">{overview?.activeCpfUsers || 0}</span> ativos
                </>
              )}
            </p>
            <p className="text-xs text-brand-green-light/70 mt-2">
              Clique esquerdo: colaboradores
              <br/>
              Clique direito: usuários CPF
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">
              Saldo total
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-green-dark">
              {formatCurrency(overview?.totalBalance || 0)}
            </div>
            <p className="text-sm text-brand-green-light mt-1">
              em créditos ativos
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">
              Transações
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-green-dark">
              {overview?.recentTransactions || 0}
            </div>
            <p className="text-sm text-brand-green-light mt-1">
              nos últimos 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Calendars */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-brand-green-dark">Entradas</h2>
            <span className="text-sm text-brand-green-light">(Depositos e Recargas)</span>
          </div>
          <ActivityCalendar
            transactions={deposits}
            showCompanyName={true}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-terracotta/10 text-brand-terracotta">
              <ArrowDownRight className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold text-brand-green-dark">Saídas</h2>
            <span className="text-sm text-brand-green-light">(Consumos)</span>
          </div>
          <ActivityCalendar
            transactions={consumes}
            showCompanyName={true}
          />
        </div>
      </div>
    </div>
  );
}
