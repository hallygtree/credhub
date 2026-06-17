import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import type { PixPaymentStatus } from '@/types';

export const PIX_STATUS_CONFIG: Record<PixPaymentStatus, { label: string; variant: 'default' | 'success' | 'secondary' | 'destructive'; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Aguardando', variant: 'default', icon: Clock },
  approved: { label: 'Aprovado', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expirado', variant: 'secondary', icon: AlertCircle },
  cancelled: { label: 'Cancelado', variant: 'secondary', icon: XCircle },
};
