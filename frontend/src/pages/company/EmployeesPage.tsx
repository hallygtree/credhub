import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getMyCompanyEmployees, createMyEmployee, deleteMyEmployee, createCompanyPixPayment, getPixPaymentStatus } from '@/services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatCPF, formatCurrency, parseBrazilianNumber } from '@/lib/utils';
import { PIX_STATUS_CONFIG } from '@/lib/constants';
import { Users, Eye, ChevronLeft, ChevronRight, Trash2, Loader2, Wallet, Plus, QrCode, Copy, CheckCircle2, XCircle } from 'lucide-react';
import type { PixPaymentResponse, PixPaymentStatus } from '@/types';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  isActive: boolean;
}

const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional(),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

export function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReloadDialogOpen, setIsReloadDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [reloadAmount, setReloadAmount] = useState('');
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<PixPaymentResponse | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['my-company-employees', search, currentPage],
    queryFn: () => getMyCompanyEmployees(currentPage, itemsPerPage, search || undefined),
  });

  const createForm = useForm<CreateEmployeeFormData>({
    resolver: zodResolver(createEmployeeSchema),
  });

  const createMutation = useMutation({
    mutationFn: createMyEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company-employees'] });
      queryClient.invalidateQueries({ queryKey: ['company-overview'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast.success('Colaborador cadastrado com sucesso!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMyEmployee(selectedEmployee!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-company-employees'] });
      setIsDeleteDialogOpen(false);
      toast.success('Colaborador excluido com sucesso');
    },
  });

  const pixMutation = useMutation({
    mutationFn: (data: { amountPerEmployee: number; employeeIds: string[] }) =>
      createCompanyPixPayment(data),
    onSuccess: (response) => {
      setPixPayment(response.data);
    },
  });

  // Poll Pix payment status while pending
  const { data: pixStatusData } = useQuery({
    queryKey: ['pix-status', pixPayment?.paymentId],
    queryFn: async () => {
      const result = await getPixPaymentStatus(pixPayment!.paymentId);
      if (result.data?.status === 'approved') {
        queryClient.invalidateQueries({ queryKey: ['my-company-employees'] });
        queryClient.invalidateQueries({ queryKey: ['company-overview'] });
      }
      return result;
    },
    enabled: !!pixPayment && pixPayment.status === 'pending',
    refetchInterval: 5000,
  });

  const pixCurrentStatus: PixPaymentStatus = pixStatusData?.data?.status || pixPayment?.status || 'pending';

  // Redirect to company overview when payment is approved
  useEffect(() => {
    if (pixCurrentStatus !== 'approved') return;
    const timer = setTimeout(() => {
      handleCloseReloadDialog();
      navigate('/app/company/overview');
    }, 2500);
    return () => clearTimeout(timer);
  }, [pixCurrentStatus, navigate]);

  const handleDeleteClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenReloadDialog = () => {
    setReloadAmount('');
    setReloadError(null);
    setIsReloadDialogOpen(true);
  };

  const handleCloseReloadDialog = () => {
    setIsReloadDialogOpen(false);
    setReloadAmount('');
    setReloadError(null);
    setSelectedEmployeeIds([]);
    setPixPayment(null);
    setPixCopied(false);
  };

  const handlePixSubmit = () => {
    setReloadError(null);

    if (selectedEmployeeIds.length === 0) {
      setReloadError('Selecione pelo menos um colaborador');
      return;
    }

    const amount = parseBrazilianNumber(reloadAmount);
    if (amount <= 0) {
      setReloadError('Digite um valor maior que zero');
      return;
    }

    pixMutation.mutate({
      amountPerEmployee: amount,
      employeeIds: selectedEmployeeIds,
    });
  };

  const handlePixCopy = async () => {
    if (pixPayment?.copiaECola) {
      await navigator.clipboard.writeText(pixPayment.copiaECola);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    }
  };

  const handlePixNewPayment = () => {
    setPixPayment(null);
    setPixCopied(false);
    setReloadAmount('');
    setSelectedEmployeeIds([]);
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployeeIds(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeEmployeeIds = employees.filter((e) => e.isActive).map((e) => e.id);
      setSelectedEmployeeIds(activeEmployeeIds);
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const employees: Employee[] = data?.data?.employees || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalEmployees = data?.data?.total || 0;
  const activeEmployees = employees.filter((e) => e.isActive);
  const allActiveSelected = activeEmployees.length > 0 && activeEmployees.every((e) => selectedEmployeeIds.includes(e.id));

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-brand-green-dark">Colaboradores</h1>
          <p className="text-brand-green-light mt-1">
            Gerencie os colaboradores da sua empresa inscritos no programa
          </p>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleOpenReloadDialog}>
            <Wallet className="mr-2 h-4 w-4" />
            Recarregar Saldos
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Colaborador
          </Button>
        </div>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo Colaborador</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nome</Label>
              <Input id="create-name" {...createForm.register('name')} />
              {createForm.formState.errors.name && (
                <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Telefone</Label>
              <Input id="create-phone" {...createForm.register('phone')} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-cpf">CPF (apenas números)</Label>
              <Input id="create-cpf" {...createForm.register('cpf')} placeholder="00000000000" />
              {createForm.formState.errors.cpf && (
                <p className="text-sm text-destructive">{createForm.formState.errors.cpf.message}</p>
              )}
            </div>
            <div className="border-t border-brand-cream-dark pt-4">
              <h3 className="font-medium text-brand-green-dark mb-4">Usuário do Colaborador</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input id="create-email" type="email" {...createForm.register('email')} />
                  {createForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{createForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Senha</Label>
                  <Input id="create-password" type="password" {...createForm.register('password')} />
                  {createForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{createForm.formState.errors.password.message}</p>
                  )}
                </div>
              </div>
            </div>
            {createMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                Erro ao cadastrar colaborador. Verifique se o CPF ou email já estão cadastrados.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : 'Criar Colaborador'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-brand-green-dark">Tem certeza que deseja excluir <strong>{selectedEmployee?.name}</strong>?</p>
            <p className="text-sm text-brand-green-light">Esta ação não pode ser desfeita. Todas as transações do colaborador também serão excluídas.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReloadDialogOpen} onOpenChange={(open) => !open && handleCloseReloadDialog()}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recarregar Saldos</DialogTitle>
          </DialogHeader>

          {!pixPayment ? (
            <div className="space-y-4">
              {reloadError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {reloadError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reload-amount">Valor por colaborador (R$)</Label>
                <Input
                  id="reload-amount"
                  type="text"
                  inputMode="decimal"
                  value={reloadAmount}
                  onChange={(e) => setReloadAmount(e.target.value)}
                  placeholder="Ex: 100,00"
                />
                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100, 200].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReloadAmount(String(value))}
                    >
                      R$ {value}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Selecione os colaboradores</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allActiveSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label htmlFor="select-all" className="text-sm font-normal cursor-pointer">
                      Selecionar todos ({activeEmployees.length})
                    </Label>
                  </div>
                </div>
                <div className="border border-brand-cream-dark rounded-lg max-h-64 overflow-y-auto">
                  {employees.length === 0 ? (
                    <p className="p-4 text-sm text-brand-green-light text-center">Nenhum colaborador encontrado</p>
                  ) : (
                    <div className="divide-y divide-brand-cream-dark">
                      {employees.map((employee) => (
                        <div
                          key={employee.id}
                          className={`flex items-center gap-3 p-3 ${!employee.isActive ? 'opacity-50' : ''}`}
                        >
                          <Checkbox
                            id={`emp-${employee.id}`}
                            checked={selectedEmployeeIds.includes(employee.id)}
                            onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                            disabled={!employee.isActive}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-brand-green-dark truncate">{employee.name}</p>
                            <p className="text-sm text-brand-green-light truncate">{employee.email}</p>
                          </div>
                          {!employee.isActive && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-brand-green-light">
                  {selectedEmployeeIds.length} colaborador(es) selecionado(s)
                </p>
              </div>

              {/* Total display */}
              {selectedEmployeeIds.length > 0 && parseBrazilianNumber(reloadAmount) > 0 && (
                <div className="rounded-lg bg-brand-cream p-4">
                  <p className="text-sm text-brand-green-light">Valor total:</p>
                  <p className="text-2xl font-bold text-brand-green-dark">
                    {formatCurrency(parseBrazilianNumber(reloadAmount) * selectedEmployeeIds.length)}
                  </p>
                  <p className="text-xs text-brand-green-light mt-1">
                    {formatCurrency(parseBrazilianNumber(reloadAmount))} x {selectedEmployeeIds.length} colaborador(es)
                  </p>
                </div>
              )}

              {pixMutation.isError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {(pixMutation.error as Error & { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao gerar pagamento Pix'}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-brand-cream-dark">
                <Button type="button" variant="outline" onClick={handleCloseReloadDialog}>
                  Cancelar
                </Button>
                <Button onClick={handlePixSubmit} disabled={pixMutation.isPending}>
                  {pixMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando Pix...</>
                  ) : (
                    <><QrCode className="mr-2 h-4 w-4" />Pagar com Pix</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Pix QR Code display */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-brand-green-light">Pagamento Pix</p>
                {(() => {
                  const config = PIX_STATUS_CONFIG[pixCurrentStatus];
                  const StatusIcon = config.icon;
                  return (
                    <Badge variant={config.variant}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {config.label}
                    </Badge>
                  );
                })()}
              </div>

              <div className="text-center">
                <p className="text-sm text-brand-green-light mb-1">Valor total</p>
                <p className="text-3xl font-bold text-brand-green-dark">{formatCurrency(pixPayment.amount)}</p>
              </div>

              {pixCurrentStatus === 'pending' && (
                <>
                  {pixPayment.qrCodeBase64 ? (
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-xl border border-brand-cream-dark shadow-brand-sm">
                        <img
                          src={`data:image/png;base64,${pixPayment.qrCodeBase64}`}
                          alt="QR Code Pix"
                          className="w-56 h-56"
                        />
                      </div>
                    </div>
                  ) : pixPayment.ticketUrl ? (
                    <div className="text-center">
                      <a
                        href={pixPayment.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-terracotta hover:underline font-medium"
                      >
                        Abrir pagina de pagamento Pix
                      </a>
                    </div>
                  ) : null}

                  {pixPayment.copiaECola && (
                    <div className="space-y-2">
                      <Label className="text-brand-green-light">Pix Copia e Cola</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={pixPayment.copiaECola}
                          className="font-mono text-xs"
                        />
                        <Button variant="outline" size="icon" onClick={handlePixCopy}>
                          {pixCopied ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {pixCurrentStatus === 'approved' && (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto mb-3" />
                  <p className="text-lg font-medium text-emerald-700">Pagamento confirmado!</p>
                  <p className="text-sm text-brand-green-light">Redirecionando para o painel...</p>
                </div>
              )}

              {(pixCurrentStatus === 'rejected' || pixCurrentStatus === 'expired' || pixCurrentStatus === 'cancelled') && (
                <div className="text-center py-4">
                  <XCircle className="h-16 w-16 text-red-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-red-600">
                    {pixCurrentStatus === 'expired' ? 'Pagamento expirado' : 'Pagamento nao aprovado'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-brand-cream-dark">
                <Button variant="outline" onClick={handleCloseReloadDialog}>
                  Fechar
                </Button>
                <Button variant="outline" onClick={handlePixNewPayment}>
                  Novo Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-brand-green-dark">Lista de Colaboradores</CardTitle>
            <Input
              placeholder="Buscar colaborador..."
              className="w-full sm:max-w-xs"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-green-dark border-t-transparent"></div>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-brand-green-light" />
              </div>
              <h3 className="text-lg font-medium text-brand-green-dark">Nenhum colaborador encontrado</h3>
              <p className="text-brand-green-light">
                {search ? 'Tente uma busca diferente.' : 'Nenhum colaborador foi cadastrado ainda.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id} className="hover:bg-brand-cream/50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-brand-green-dark">{employee.name}</p>
                            <p className="text-sm text-brand-green-light">{employee.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-brand-green-dark font-mono text-sm">{formatCPF(employee.cpf)}</TableCell>
                        <TableCell>
                          <Badge variant={employee.isActive ? 'success' : 'secondary'}>
                            {employee.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(employee)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" asChild className="text-brand-terracotta hover:text-brand-terracotta">
                              <Link to={`/app/company/employees/${employee.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Detalhes
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {employees.map((employee) => (
                  <div key={employee.id} className="rounded-lg border border-brand-cream-dark bg-white p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-brand-green-dark truncate">{employee.name}</p>
                        <p className="text-sm text-brand-green-light truncate">{employee.email}</p>
                      </div>
                      <Badge variant={employee.isActive ? 'success' : 'secondary'} className="text-xs ml-2">
                        {employee.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-sm text-brand-green-light font-mono mb-3">{formatCPF(employee.cpf)}</p>
                    <div className="flex gap-2 pt-3 border-t border-brand-cream-dark">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(employee)} className="text-brand-green-light">
                        <Trash2 className="mr-1 h-4 w-4" />
                        Excluir
                      </Button>
                      <Button variant="default" size="sm" className="ml-auto" asChild>
                        <Link to={`/app/company/employees/${employee.id}`}>
                          <Eye className="mr-1 h-4 w-4" />
                          Detalhes
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalEmployees > itemsPerPage && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-brand-cream-dark">
                  <p className="text-sm text-brand-green-light">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalEmployees)} de {totalEmployees} colaboradores
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-brand-green-dark whitespace-nowrap">Página {currentPage} de {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
