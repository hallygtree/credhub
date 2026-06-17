import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompany, getCompanyEmployees, getCompanyTransactions, updateAdminEmployee } from '@/services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActivityCalendar } from '@/components/ui/activity-calendar';
import { formatCurrency, formatCPF } from '@/lib/utils';
import { Users, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  email: string;
  cpf: string;
  cardNumber?: string;
  phone?: string;
  address?: string;
  zipCode?: string;
  balance: number;
  isActive: boolean;
}

const editEmployeeSchema = z.object({
  cardNumber: z.string().optional(),
});

type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();

  const { data: companyData } = useQuery({
    queryKey: ['company', id],
    queryFn: () => getCompany(id!),
    enabled: !!id,
  });

  const companyName = companyData?.data?.company?.name;

  const { data, isLoading } = useQuery({
    queryKey: ['company-employees', id, search, currentPage],
    queryFn: () => getCompanyEmployees(id!, currentPage, itemsPerPage, search || undefined),
    enabled: !!id,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['company-transactions', id],
    queryFn: () => getCompanyTransactions(id!, 1, 100),
    enabled: !!id,
  });

  const employees: Employee[] = data?.data?.employees || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalEmployees = data?.data?.total || 0;
  const transactions = transactionsData?.data?.transactions || [];

  const editForm = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: (data: EditEmployeeFormData) =>
      updateAdminEmployee(selectedEmployee!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-employees', id] });
      setIsEditDialogOpen(false);
      toast.success('Cartao atualizado com sucesso!');
    },
  });

  const handleEditClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    editForm.reset({
      cardNumber: employee.cardNumber || '',
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6 lg:space-y-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-brand-green-dark">
            Funcionários{companyName ? ` da ${companyName}` : ''}
          </h1>
          <p className="text-brand-green-light">Gerencie os colaboradores da empresa</p>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cartao - {selectedEmployee?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((data) => updateEmployeeMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-cardNumber">Numero do Cartão de Acesso</Label>
              <Input id="edit-cardNumber" {...editForm.register('cardNumber')} placeholder="Numero do cartao" />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateEmployeeMutation.isPending} loading={updateEmployeeMutation.isPending}>
                {updateEmployeeMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Funcionários</CardTitle>
            <Input
              placeholder="Buscar por nome ou cartao..."
              className="max-w-xs"
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green-dark"></div>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-brand-green-light" />
              </div>
              <h3 className="text-lg font-medium text-brand-green-dark">Nenhum funcionário cadastrado</h3>
              <p className="text-brand-green-light">
                Os funcionários sao cadastrados pelo gestor da empresa.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cartão</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-brand-green-dark">{employee.name}</p>
                          <p className="text-sm text-brand-green-light">{employee.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCPF(employee.cpf)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(employee.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? 'success' : 'secondary'}>
                          {employee.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className='font-mono text-sm'>
                        {employee.cardNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(employee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalEmployees > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-cream-dark">
                  <p className="text-sm text-brand-green-light">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalEmployees)} de {totalEmployees} funcionários
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Pagina {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ActivityCalendar transactions={transactions} />
    </div>
  );
}
