import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserMe, getUserTransactions, updateUserMe } from '@/services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Wallet, Pencil, Loader2, ArrowUpRight, ArrowDownRight, RotateCcw, CreditCard, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const editProfileSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  phone: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  email: z.string().email('Email invalido'),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
}).refine((data) => {
  // If any password field is filled, all must be filled
  const hasCurrentPassword = !!data.currentPassword;
  const hasNewPassword = !!data.newPassword;
  const hasConfirmPassword = !!data.confirmNewPassword;

  if (hasCurrentPassword || hasNewPassword || hasConfirmPassword) {
    return hasCurrentPassword && hasNewPassword && hasConfirmPassword;
  }
  return true;
}, {
  message: 'Preencha todos os campos de senha para alterar',
  path: ['currentPassword'],
}).refine((data) => {
  if (data.newPassword && data.confirmNewPassword) {
    return data.newPassword === data.confirmNewPassword;
  }
  return true;
}, {
  message: 'As senhas nao coincidem',
  path: ['confirmNewPassword'],
}).refine((data) => {
  if (data.newPassword) {
    return data.newPassword.length >= 8;
  }
  return true;
}, {
  message: 'A nova senha deve ter no minimo 8 caracteres',
  path: ['newPassword'],
}).refine((data) => {
  if (data.newPassword) {
    return /[A-Z]/.test(data.newPassword) && /[a-z]/.test(data.newPassword) && /[0-9]/.test(data.newPassword) && /[^A-Za-z0-9]/.test(data.newPassword);
  }
  return true;
}, {
  message: 'A senha deve ter maiuscula, minuscula, numero e caractere especial',
  path: ['newPassword'],
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}
export function UserDashboard() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const queryClient = useQueryClient();

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: getUserMe,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['user-transactions'],
    queryFn: () => getUserTransactions(1, 20),
  });

  const editForm = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
  });

  const updateMutation = useMutation({
    mutationFn: updateUserMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      setIsEditDialogOpen(false);
      toast.success('Perfil atualizado com sucesso!');
    },
  });

  const handleEditClick = () => {
    if (profile) {
      editForm.reset({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        zipCode: profile.zipCode || '',
        email: profile.email || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    }
    setShowPasswordFields(false);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setShowPasswordFields(false);
  };

  const profile = meData?.data?.profile;
  const transactions = txData?.data?.transactions || [];

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'CREDIT_RESET') return <RotateCcw className="h-4 w-4 text-blue-600" />;
    return amount > 0
      ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
      : <ArrowDownRight className="h-4 w-4 text-brand-terracotta" />;
  };

  if (meLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-green-dark border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-brand-green-dark">Meu Painel</h1>
        </div>
        <Button variant="outline" onClick={handleEditClick} className="w-full sm:w-auto">
          <Pencil className="mr-2 h-4 w-4" />
          Editar Perfil
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">Saldo Disponivel</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-brand-green-dark">{formatCurrency(profile?.balance || 0)}</div>
            {profile?.companyName && (
              <p className="text-sm text-brand-green-light mt-1">{profile.companyName}</p>
            )}
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">Cartão de Acesso</CardTitle>
            <div className="p-2 rounded-lg bg-brand-terracotta/10 text-brand-terracotta group-hover:bg-brand-terracotta group-hover:text-white transition-colors">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {profile?.cardNumber ? (
              <div className="text-xl font-mono font-bold text-brand-green-dark">{profile.cardNumber}</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <MapPin className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Cartao nao cadastrado</p>
                    <p className="text-amber-700 mt-1">
                      Solicite seu cartão de acesso no balcão de atendimento. Apresente seu cadastro:
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-brand-cream/50 border border-brand-cream-dark">
                  <p className="text-sm font-medium text-brand-green-dark">{profile?.name}</p>
                  <p className="text-xs text-brand-green-light">{profile?.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-brand-green-dark">Ultimas Transacoes</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-green-dark border-t-transparent"></div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-brand-green-light text-center py-8">Nenhuma transacao encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="hidden sm:table-cell">Descricao</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: Transaction) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {getTransactionIcon(tx.type, tx.amount)}
                          {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-brand-green-dark">{tx.description}</TableCell>
                      <TableCell className={`text-right font-medium whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-600' : 'text-brand-terracotta'}`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap hidden sm:table-cell text-brand-green-dark">{formatCurrency(tx.balanceAfter)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input id="edit-name" {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input id="edit-phone" {...editForm.register('phone')} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Endereco</Label>
              <Input id="edit-address" {...editForm.register('address')} placeholder="Rua, numero, complemento" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-zipCode">CEP</Label>
              <Input id="edit-zipCode" {...editForm.register('zipCode')} placeholder="00000-000" />
            </div>

            {/* Email Section */}
            <div className="border-t border-brand-cream-dark pt-4 mt-4">
              <h3 className="font-medium text-brand-green-dark mb-3">Dados de Acesso</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" {...editForm.register('email')} />
                {editForm.formState.errors.email && <p className="text-sm text-destructive">{editForm.formState.errors.email.message}</p>}
              </div>
              {!showPasswordFields && (
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(true)}
                  className="text-sm text-brand-terracotta hover:underline mt-2"
                >
                  Alterar senha
                </button>
              )}
            </div>

            {/* Password Change Section - Only visible when toggled */}
            {showPasswordFields && (
              <div className="border-t border-brand-cream-dark pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-brand-green-dark">Alterar Senha</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordFields(false);
                      editForm.setValue('currentPassword', '');
                      editForm.setValue('newPassword', '');
                      editForm.setValue('confirmNewPassword', '');
                    }}
                    className="text-xs text-brand-green-light hover:text-destructive"
                  >
                    Cancelar alteracao
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-currentPassword">Senha Atual</Label>
                    <Input id="edit-currentPassword" type="password" {...editForm.register('currentPassword')} placeholder="Digite sua senha atual" />
                    {editForm.formState.errors.currentPassword && <p className="text-sm text-destructive">{editForm.formState.errors.currentPassword.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-newPassword">Nova Senha</Label>
                    <Input id="edit-newPassword" type="password" {...editForm.register('newPassword')} placeholder="Minimo 8 caracteres" />
                    {editForm.formState.errors.newPassword && <p className="text-sm text-destructive">{editForm.formState.errors.newPassword.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-confirmNewPassword">Confirmar Nova Senha</Label>
                    <Input id="edit-confirmNewPassword" type="password" {...editForm.register('confirmNewPassword')} placeholder="Repita a nova senha" />
                    {editForm.formState.errors.confirmNewPassword && <p className="text-sm text-destructive">{editForm.formState.errors.confirmNewPassword.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {updateMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {(updateMutation.error as Error & { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao atualizar perfil'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleCloseEditDialog}>Cancelar</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
