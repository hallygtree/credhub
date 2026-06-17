import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPixPayment,
  getPixPaymentStatus,
  getUserPayments,
} from '@/services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrency } from '@/lib/utils';
import { PIX_STATUS_CONFIG } from '@/lib/constants';
import {
  QrCode,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { PixPaymentResponse, PixPaymentStatus } from '@/types';

const pixAmountSchema = z.object({
  amount: z.number().min(1, 'Valor minimo: R$ 1,00'),
});

type PixAmountFormData = z.infer<typeof pixAmountSchema>;

export function PixPaymentPage() {
  return <UserPixFlow />;
}

// ─── EMPLOYEE / CPF_USER Flow ────────────────────────────────────────────────

function UserPixFlow() {
  const [currentPayment, setCurrentPayment] = useState<PixPaymentResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const form = useForm<PixAmountFormData>({
    resolver: zodResolver(pixAmountSchema),
    defaultValues: { amount: 50 },
  });

  const createMutation = useMutation({
    mutationFn: createPixPayment,
    onSuccess: (response) => {
      setCurrentPayment(response.data);
      queryClient.invalidateQueries({ queryKey: ['user-payments'] });
    },
  });

  // Poll payment status while pending
  const { data: statusData } = useQuery({
    queryKey: ['pix-status', currentPayment?.paymentId],
    queryFn: () => getPixPaymentStatus(currentPayment!.paymentId),
    enabled: !!currentPayment && currentPayment.status === 'pending',
    refetchInterval: 5000,
  });

  const currentStatus: PixPaymentStatus = statusData?.data?.status || currentPayment?.status || 'pending';

  const { data: paymentsData } = useQuery({
    queryKey: ['user-payments'],
    queryFn: () => getUserPayments(1, 10),
  });

  // Refresh table and redirect to dashboard when payment is approved
  useEffect(() => {
    if (currentStatus !== 'approved') return;
    queryClient.invalidateQueries({ queryKey: ['user-payments'] });
    const timer = setTimeout(() => navigate('/app/user/dashboard'), 2500);
    return () => clearTimeout(timer);
  }, [currentStatus, queryClient, navigate]);

  const handleCopy = async () => {
    if (currentPayment?.copiaECola) {
      await navigator.clipboard.writeText(currentPayment.copiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewPayment = () => {
    setCurrentPayment(null);
    setSelectedAmount(50);
    form.reset({ amount: 50 });
  };

  const handleQuickAmount = (value: number) => {
    setSelectedAmount(value);
    form.setValue('amount', value);
  };

  const payments = paymentsData?.data?.payments || [];

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-green-dark">Pagar com Pix</h1>
        <p className="text-brand-green-light mt-1">Adicione saldo a sua conta via Pix</p>
      </div>

      {!currentPayment ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-brand-green-dark">Gerar Pagamento Pix</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[20, 50, 100, 200].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleQuickAmount(value)}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all duration-200 ${
                      selectedAmount === value
                        ? 'border-brand-green-dark bg-brand-green-dark text-brand-cream shadow-brand-md'
                        : 'border-brand-cream-dark bg-white text-brand-green-dark hover:border-brand-green-light hover:shadow-brand-sm'
                    }`}
                  >
                    <span className="text-xs font-medium opacity-70">R$</span>
                    <p className="text-2xl font-bold">{value}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pix-amount" className="text-brand-green-light">Ou digite um valor personalizado</Label>
                <Input
                  id="pix-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  {...form.register('amount', { valueAsNumber: true })}
                  onChange={(e) => {
                    form.register('amount', { valueAsNumber: true }).onChange(e);
                    const val = parseFloat(e.target.value);
                    setSelectedAmount([20, 50, 100, 200].includes(val) ? val : null);
                  }}
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              {createMutation.isError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {(createMutation.error as Error & { response?: { data?: { error?: string } } })?.response?.data?.error || 'Erro ao gerar pagamento'}
                </div>
              )}
              <Button type="submit" disabled={createMutation.isPending} className="w-full h-12 text-base">
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Gerando...</>
                ) : (
                  <><QrCode className="mr-2 h-5 w-5" />Gerar Pix</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <PixQrCodeCard
          payment={currentPayment}
          currentStatus={currentStatus}
          copied={copied}
          onCopy={handleCopy}
          onNewPayment={handleNewPayment}
        />
      )}

      <PaymentHistoryTable payments={payments} />
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function PixQrCodeCard({
  payment,
  currentStatus,
  copied,
  onCopy,
  onNewPayment,
}: {
  payment: PixPaymentResponse;
  currentStatus: PixPaymentStatus;
  copied: boolean;
  onCopy: () => void;
  onNewPayment: () => void;
}) {
  const statusConfig = PIX_STATUS_CONFIG[currentStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-brand-green-dark">Pagamento Pix</CardTitle>
          <Badge variant={statusConfig.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-brand-green-light mb-2">Valor</p>
          <p className="text-3xl font-bold text-brand-green-dark">{formatCurrency(payment.amount)}</p>
        </div>

        {currentStatus === 'pending' && (
          <>
            {/* QR Code image (may be empty in test mode) */}
            {payment.qrCodeBase64 ? (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-xl border border-brand-cream-dark shadow-brand-sm">
                  <img
                    src={`data:image/png;base64,${payment.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="w-full max-w-[256px] aspect-square"
                  />
                </div>
              </div>
            ) : payment.ticketUrl ? (
              <div className="text-center">
                <a
                  href={payment.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-terracotta hover:underline font-medium"
                >
                  Abrir pagina de pagamento Pix
                </a>
              </div>
            ) : null}

            {/* Copy Pix code */}
            {payment.copiaECola && (
              <div className="space-y-2">
                <Label className="text-brand-green-light">Pix Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={payment.copiaECola}
                    className="font-mono text-xs min-w-0"
                  />
                  <Button variant="outline" size="icon" className="flex-shrink-0" onClick={onCopy}>
                    {copied ? (
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

        {currentStatus === 'approved' && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto mb-3" />
            <p className="text-lg font-medium text-emerald-700">Pagamento confirmado!</p>
            <p className="text-sm text-brand-green-light">Redirecionando para o painel...</p>
          </div>
        )}

        {(currentStatus === 'rejected' || currentStatus === 'expired' || currentStatus === 'cancelled') && (
          <div className="text-center py-4">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-red-600">
              {currentStatus === 'expired' ? 'Pagamento expirado' : 'Pagamento nao aprovado'}
            </p>
          </div>
        )}

        <Button variant="outline" onClick={onNewPayment} className="w-full">
          Novo Pagamento
        </Button>
      </CardContent>
    </Card>
  );
}

interface PaymentHistoryItem {
  id: string;
  amount: number;
  status: PixPaymentStatus;
  createdAt: string;
  amountPerEmployee?: number;
  employeeIds?: string[];
}

function PaymentHistoryTable({ payments }: { payments: PaymentHistoryItem[] }) {
  if (payments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-brand-green-dark">Pagamentos Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="hidden sm:table-cell">Detalhes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => {
                const config = PIX_STATUS_CONFIG[payment.status];
                const StatusIcon = config.icon;
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-brand-green-dark">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-brand-green-light">
                      {payment.employeeIds && payment.employeeIds.length > 0
                        ? `${payment.employeeIds.length} colaborador(es) x ${formatCurrency(payment.amountPerEmployee || 0)}`
                        : 'Recarga pessoal'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="text-xs whitespace-nowrap">
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
