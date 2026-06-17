import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEmployeeDetail } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCPF, formatDate } from '@/lib/utils';
import { User, History, ArrowUpRight, ChevronLeft } from 'lucide-react';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['employee-detail', id],
    queryFn: () => getEmployeeDetail(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-green-dark border-t-transparent"></div>
      </div>
    );
  }

  const employee = data?.data?.employee;
  const transactions = data?.data?.transactions?.transactions || [];

  return (
    <div className="space-y-6 lg:space-y-8 animate-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-brand-green-light hover:text-brand-green-dark">
            <Link to="/app/company/employees">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-brand-green-dark">{employee?.name}</h1>
            <p className="text-brand-green-light">Detalhes do funcionário e histórico de recargas</p>
          </div>
        </div>
        <Badge variant={employee?.isActive ? 'success' : 'secondary'} className="self-start sm:self-auto text-sm">
          {employee?.isActive ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">Informações</CardTitle>
            <div className="p-2 rounded-lg bg-brand-cream text-brand-green-light group-hover:bg-brand-green-dark group-hover:text-brand-cream transition-colors">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-brand-green-light">Email</dt>
                <dd className="text-sm font-medium text-brand-green-dark">{employee?.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-brand-green-light">CPF</dt>
                <dd className="text-sm font-mono font-medium text-brand-green-dark">{formatCPF(employee?.cpf || '')}</dd>
              </div>
              <div>
                <dt className="text-sm text-brand-green-light">Cadastrado em</dt>
                <dd className="text-sm font-medium text-brand-green-dark">{formatDate(employee?.createdAt || '')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="group hover:border-brand-green-light transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-brand-green-light">Status</CardTitle>
            <div className="p-2 rounded-lg bg-brand-cream text-brand-green-light group-hover:bg-brand-green-dark group-hover:text-brand-cream transition-colors">
              <History className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <Badge variant={employee?.isActive ? 'success' : 'secondary'} className="text-lg">
              {employee?.isActive ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-brand-green-dark">Histórico de Recargas</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-brand-cream flex items-center justify-center mb-4">
                <History className="h-8 w-8 text-brand-green-light" />
              </div>
              <h3 className="text-lg font-medium text-brand-green-dark">Nenhuma recarga encontrada</h3>
              <p className="text-brand-green-light">
                O histórico de recargas aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction: { id: string; createdAt: string; type: string; description: string }) => (
                    <TableRow key={transaction.id} className="hover:bg-brand-cream/50 transition-colors">
                      <TableCell className="text-brand-green-dark">{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                          <Badge variant="success">
                            {transaction.type === 'DEPOSIT' ? 'Depósito' : 'Ajuste de Crédito'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-brand-green-light">{transaction.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
