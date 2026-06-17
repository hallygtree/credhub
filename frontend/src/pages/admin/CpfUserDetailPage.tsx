import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCpfUser, updateCpfUserCard } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActivityCalendar } from '@/components/ui/activity-calendar';
import { formatCurrency } from '@/lib/utils';
import { User, CreditCard, Wallet, ChevronLeft, Pencil, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function CpfUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cpf-user', id],
    queryFn: () => getCpfUser(id!),
    enabled: !!id,
  });

  const user = data?.data?.user;
  const transactions = data?.data?.transactions || [];

  const updateCardMutation = useMutation({
    mutationFn: (newCardNumber: string | null) => updateCpfUserCard(id!, newCardNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpf-user', id] });
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setIsEditCardOpen(false);
      toast.success('Cartao atualizado com sucesso!');
    },
  });

  const handleOpenEditCard = () => {
    setCardNumber(user?.cardNumber || '');
    setIsEditCardOpen(true);
  };

  const handleSaveCard = () => {
    updateCardMutation.mutate(cardNumber.trim() || null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green-dark" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-brand-green-light">Usuário não encontrado.</p>
        <Button variant="outline" asChild>
          <Link to="/app/admin/subscribers">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-brand-green-light hover:text-brand-green-dark">
            <Link to="/app/admin/subscribers">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-brand-green-dark">{user.name}</h1>
            <p className="text-brand-green-light">Usuário CPF — detalhes da conta</p>
          </div>
        </div>
        <Badge variant={user.isActive ? 'success' : 'muted'} className="self-start sm:self-auto">
          {user.isActive ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Saldo Atual</p>
                <p className="text-2xl font-bold text-brand-green-dark">{formatCurrency(user.balance)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Number */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Cartão de Acesso</p>
                <p className="text-lg font-mono font-bold text-brand-green-dark">
                  {user.cardNumber || <span className="text-brand-green-light font-sans font-normal text-sm">Não cadastrado</span>}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenEditCard}
                className="text-brand-terracotta hover:text-brand-terracotta"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* CPF */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">CPF</p>
                <p className="text-lg font-mono font-bold text-brand-green-dark">{user.cpf}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
                <User className="h-5 w-5 text-brand-green-light" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações de Contato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-brand-green-dark">
            <Mail className="h-4 w-4 text-brand-green-light" />
            <span>{user.email}</span>
          </div>
        </CardContent>
      </Card>

      {/* Activity Calendar */}
      <div>
        <h2 className="text-lg font-semibold text-brand-green-dark mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-brand-green-light" />
          Histórico de Transações
        </h2>
        <ActivityCalendar transactions={transactions} />
      </div>

      {/* Edit Card Dialog */}
      <Dialog open={isEditCardOpen} onOpenChange={setIsEditCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cartão de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-brand-green-light">Usuário</p>
              <p className="font-medium text-brand-green-dark">{user.name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardNumber">Número do Cartão</Label>
              <Input
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Digite o número do cartão"
              />
            </div>
            {updateCardMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                Erro ao atualizar cartão. Verifique se o número já está em uso.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditCardOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveCard}
                disabled={updateCardMutation.isPending}
                loading={updateCardMutation.isPending}
              >
                {updateCardMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
