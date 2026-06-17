import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSubscribers, createCompany } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building2, User, Mail, Loader2, Filter, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateOnly } from '@/lib/utils';
import type { Subscriber } from '@/types';

const createCompanySchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 digitos'),
  email: z.string().email('Email invalido'),
  phone: z.string().optional(),
  address: z.string().optional(),
  viewerName: z.string().min(1, 'Nome do gestor e obrigatorio'),
  viewerEmail: z.string().email('Email do gestor invalido'),
  viewerPassword: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
});

type CreateCompanyFormData = z.infer<typeof createCompanySchema>;

type FilterType = 'ALL' | 'COMPANY' | 'CPF_USER';

export function SubscribersPage() {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['subscribers'],
    queryFn: getSubscribers,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyFormData>({
    resolver: zodResolver(createCompanySchema),
  });

  const createCompanyMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setIsCreateCompanyOpen(false);
      reset();
      toast.success('Empresa cadastrada com sucesso!');
    },
  });

  const allSubscribers: Subscriber[] = data?.data?.subscribers || [];

  const companyCount = allSubscribers.filter(s => s.type === 'COMPANY').length;
  const cpfUserCount = allSubscribers.filter(s => s.type === 'CPF_USER').length;

  // Filter subscribers based on selected filter
  const subscribers = filter === 'ALL'
    ? allSubscribers
    : allSubscribers.filter(s => s.type === filter);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-brand-green-dark">Inscritos</h1>
          <p className="text-brand-green-light">Empresas e usuários cadastrados no sistema</p>
        </div>

        <Dialog open={isCreateCompanyOpen} onOpenChange={setIsCreateCompanyOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((data) => createCompanyMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" required>Nome da Empresa</Label>
                  <Input id="name" {...register('name')} error={!!errors.name} />
                  {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj" required>CNPJ (apenas numeros)</Label>
                  <Input id="cnpj" {...register('cnpj')} placeholder="00000000000000" error={!!errors.cnpj} />
                  {errors.cnpj && <p className="text-sm text-red-600">{errors.cnpj.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" required>Email da Empresa</Label>
                  <Input id="email" type="email" {...register('email')} error={!!errors.email} />
                  {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" {...register('phone')} />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-2">
                  <Label htmlFor="address">Endereco</Label>
                  <Input id="address" {...register('address')} />
                </div>
              </div>
              <div className="border-t border-brand-cream-dark pt-4">
                <h3 className="font-medium text-brand-green-dark mb-4">Usuário do Gestor</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="viewerName" required>Nome</Label>
                    <Input id="viewerName" {...register('viewerName')} error={!!errors.viewerName} />
                    {errors.viewerName && <p className="text-sm text-red-600">{errors.viewerName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="viewerEmail" required>Email de Acesso</Label>
                    <Input id="viewerEmail" type="email" {...register('viewerEmail')} error={!!errors.viewerEmail} />
                    {errors.viewerEmail && <p className="text-sm text-red-600">{errors.viewerEmail.message}</p>}
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-2">
                    <Label htmlFor="viewerPassword" required>Senha</Label>
                    <Input id="viewerPassword" type="password" {...register('viewerPassword')} error={!!errors.viewerPassword} />
                    {errors.viewerPassword && <p className="text-sm text-red-600">{errors.viewerPassword.message}</p>}
                  </div>
                </div>
              </div>
              {createCompanyMutation.isError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  Erro ao criar empresa. Verifique os dados e tente novamente.
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateCompanyOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || createCompanyMutation.isPending} loading={isSubmitting || createCompanyMutation.isPending}>
                  {(isSubmitting || createCompanyMutation.isPending) ? 'Criando...' : 'Criar Empresa'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards - clickable for filtering */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all ${filter === 'ALL' ? 'ring-2 ring-brand-terracotta' : 'hover:shadow-md'}`}
          onClick={() => setFilter('ALL')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Total de inscritos</p>
                <p className="text-2xl font-bold text-brand-green-dark">{allSubscribers.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
                <User className="h-5 w-5 text-brand-green-light" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === 'COMPANY' ? 'ring-2 ring-brand-terracotta' : 'hover:shadow-md'}`}
          onClick={() => setFilter('COMPANY')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Empresas (CNPJ)</p>
                <p className="text-2xl font-bold text-brand-green-dark">{companyCount}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
                <Building2 className="h-5 w-5 text-brand-green-light" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === 'CPF_USER' ? 'ring-2 ring-brand-terracotta' : 'hover:shadow-md'}`}
          onClick={() => setFilter('CPF_USER')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-brand-green-light">Usuários (CPF)</p>
                <p className="text-2xl font-bold text-brand-green-dark">{cpfUserCount}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
                <User className="h-5 w-5 text-brand-terracotta" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter indicator */}
      {filter !== 'ALL' && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-green-light" />
          <span className="text-sm text-brand-green-light">
            Filtrando por: <strong className="text-brand-green-dark">{filter === 'COMPANY' ? 'Empresas (CNPJ)' : 'Usuários (CPF)'}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFilter('ALL')} className="text-brand-terracotta hover:text-brand-terracotta">
            Limpar filtro
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-brand-green-dark" />
        </div>
      ) : subscribers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-brand-green-light" />
            </div>
            <h3 className="text-lg font-medium text-brand-green-dark">
              {filter === 'ALL' ? 'Nenhum inscrito encontrado' : `Nenhum ${filter === 'COMPANY' ? 'empresa' : 'usuario CPF'} encontrado`}
            </h3>
            <p className="text-brand-green-light">
              {filter === 'ALL' ? 'Os inscritos aparecerao aqui quando cadastrados.' : 'Tente limpar o filtro para ver todos os inscritos.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle>
                {filter === 'ALL' ? 'Lista de Inscritos' : filter === 'COMPANY' ? 'Empresas (CNPJ)' : 'Usuarios (CPF)'}
                <span className="ml-2 text-sm font-normal text-brand-green-light">({subscribers.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cartao</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((subscriber) => (
                    <TableRow key={`${subscriber.type}-${subscriber.id}`} className="hover:bg-brand-cream/50 transition-colors">
                      <TableCell>
                        <Badge variant={subscriber.type === 'COMPANY' ? 'default' : 'secondary'}>
                          {subscriber.type === 'COMPANY' ? (
                            <><Building2 className="h-3 w-3 mr-1" /> CNPJ</>
                          ) : (
                            <><User className="h-3 w-3 mr-1" /> CPF</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-brand-green-dark">{subscriber.name}</p>
                      </TableCell>
                      <TableCell className="text-brand-green-dark font-mono text-sm">
                        {subscriber.document}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-brand-green-light">
                          <Mail className="h-4 w-4" />
                          <span className="text-sm">{subscriber.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {subscriber.type === 'CPF_USER' && (
                          <span className="text-sm font-mono text-brand-green-dark">
                            {subscriber.cardNumber || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={subscriber.isActive ? 'success' : 'muted'}>
                          {subscriber.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild className="text-brand-terracotta hover:text-brand-terracotta">
                          {subscriber.type === 'COMPANY' ? (
                            <Link to={`/app/admin/subscribers/${subscriber.id}`}>Ver detalhes</Link>
                          ) : (
                            <Link to={`/app/admin/cpf-users/${subscriber.id}`}>Ver detalhes</Link>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            <h2 className="text-lg font-semibold text-brand-green-dark">
              {filter === 'ALL' ? 'Lista de Inscritos' : filter === 'COMPANY' ? 'Empresas (CNPJ)' : 'Usuarios (CPF)'}
              <span className="ml-2 text-sm font-normal text-brand-green-light">({subscribers.length})</span>
            </h2>
            {subscribers.map((subscriber) => (
              <Card key={`${subscriber.type}-${subscriber.id}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={subscriber.type === 'COMPANY' ? 'default' : 'secondary'} className="text-xs">
                          {subscriber.type === 'COMPANY' ? 'CNPJ' : 'CPF'}
                        </Badge>
                        <Badge variant={subscriber.isActive ? 'success' : 'muted'} className="text-xs">
                          {subscriber.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-brand-green-dark truncate">{subscriber.name}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-brand-green-light">Documento</p>
                      <p className="font-mono text-brand-green-dark">{subscriber.document}</p>
                    </div>
                    <div>
                      <p className="text-brand-green-light">Cadastro</p>
                      <p className="text-brand-green-dark">{formatDateOnly(subscriber.createdAt)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-brand-green-light">Email</p>
                      <p className="text-brand-green-dark truncate">{subscriber.email}</p>
                    </div>
                    {subscriber.type === 'CPF_USER' && (
                      <div className="col-span-2">
                        <p className="text-brand-green-light">Cartão de Acesso</p>
                        <p className="font-mono text-brand-green-dark">{subscriber.cardNumber || 'Nao cadastrado'}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-brand-cream-dark">
                    <Button variant="default" size="sm" className="w-full" asChild>
                      {subscriber.type === 'COMPANY' ? (
                        <Link to={`/app/admin/subscribers/${subscriber.id}`}>Ver detalhes</Link>
                      ) : (
                        <Link to={`/app/admin/cpf-users/${subscriber.id}`}>Ver detalhes</Link>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
