import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, RotateCcw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: string;
  createdAt: string;
  batchId?: string;
  employeeId?: { name: string; email: string };
  cpfUserId?: { name: string; email: string };
  companyId?: { name: string };
}

interface ActivityCalendarProps {
  transactions: Transaction[];
  title?: string;
  showCompanyName?: boolean;
}

interface ConsolidatedTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
  employeeId?: { name: string; email: string };
  cpfUserId?: { name: string; email: string };
  companyId?: { name: string };
  isConsolidated?: boolean;
  consolidatedCount?: number;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function ActivityCalendar({ transactions, showCompanyName = false }: ActivityCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());

  useEffect(() => {
    if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      setSelectedDay(today.getDate());
    }
  }, [currentMonth, currentYear]);

  const transactionsByDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();

    transactions.forEach(t => {
      const date = new Date(t.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const existing = map.get(key) || [];
      existing.push(t);
      map.set(key, existing);
    });

    return map;
  }, [transactions]);

  const getDayTransactions = (day: number) => {
    const key = `${currentYear}-${currentMonth}-${day}`;
    return transactionsByDay.get(key) || [];
  };

  const getConsolidatedTransactions = (day: number): ConsolidatedTransaction[] => {
    const dayTransactions = getDayTransactions(day);
    const result: ConsolidatedTransaction[] = [];

    // Group CREDIT_RESET transactions by company
    const creditResets = dayTransactions.filter(t => t.type === 'CREDIT_RESET');
    const nonResetTransactions = dayTransactions.filter(t => t.type !== 'CREDIT_RESET');

    if (creditResets.length > 0) {
      const resetsByCompany = new Map<string, Transaction[]>();
      creditResets.forEach(t => {
        const companyName = t.companyId?.name || 'Empresa';
        const existing = resetsByCompany.get(companyName) || [];
        existing.push(t);
        resetsByCompany.set(companyName, existing);
      });

      resetsByCompany.forEach((companyResets, companyName) => {
        const firstReset = companyResets[0];
        result.push({
          id: `consolidated-reset-${companyName}`,
          type: 'CREDIT_RESET',
          amount: 0,
          description: `Reset de crédito para ${companyResets.length} funcionário(s)`,
          createdAt: firstReset.createdAt,
          companyId: { name: companyName },
          isConsolidated: true,
          consolidatedCount: companyResets.length,
        });
      });
    }

    // Group bulk deposits by batchId
    const batchedDeposits = new Map<string, Transaction[]>();
    const nonBatchedTransactions: Transaction[] = [];

    nonResetTransactions.forEach(t => {
      if (t.batchId) {
        const existing = batchedDeposits.get(t.batchId) || [];
        existing.push(t);
        batchedDeposits.set(t.batchId, existing);
      } else {
        nonBatchedTransactions.push(t);
      }
    });

    // Add consolidated batch deposits
    batchedDeposits.forEach((batchTransactions, batchId) => {
      const firstTransaction = batchTransactions[0];
      const totalAmount = batchTransactions.reduce((sum, t) => sum + t.amount, 0);
      result.push({
        id: `consolidated-batch-${batchId}`,
        type: 'BATCH_DEPOSIT',
        amount: totalAmount,
        description: `Recarga em lote para ${batchTransactions.length} funcionário(s)`,
        createdAt: firstTransaction.createdAt,
        companyId: firstTransaction.companyId,
        isConsolidated: true,
        consolidatedCount: batchTransactions.length,
      });
    });

    // Add non-batched transactions individually
    nonBatchedTransactions.forEach(t => {
      result.push({
        ...t,
        isConsolidated: false,
      });
    });

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const hasTransactions = (day: number) => {
    return getDayTransactions(day).length > 0;
  };

  const getDayStats = (day: number) => {
    const dayTransactions = getDayTransactions(day);
    const deposits = dayTransactions.filter(t => t.amount > 0 && t.type !== 'CREDIT_RESET');
    const consumes = dayTransactions.filter(t => t.amount < 0);
    const resets = dayTransactions.filter(t => t.type === 'CREDIT_RESET');
    return { deposits: deposits.length, consumes: consumes.length, resets: resets.length };
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const selectedDayTransactions = getConsolidatedTransactions(selectedDay);

  const getTransactionIcon = (type: string, amount: number, isConsolidated?: boolean) => {
    if (type === 'CREDIT_RESET') {
      return <RotateCcw className="h-4 w-4 text-blue-600" />;
    }
    if (type === 'BATCH_DEPOSIT' || isConsolidated) {
      return <Users className="h-4 w-4 text-emerald-600" />;
    }
    return amount > 0
      ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
      : <ArrowDownRight className="h-4 w-4 text-brand-terracotta" />;
  };

  const getTransactionBgColor = (type: string, amount: number) => {
    if (type === 'CREDIT_RESET') return 'bg-blue-100';
    if (type === 'BATCH_DEPOSIT') return 'bg-emerald-100';
    return amount > 0 ? 'bg-emerald-100' : 'bg-brand-terracotta/10';
  };

  const getDisplayName = (transaction: ConsolidatedTransaction) => {
    if (transaction.type === 'CREDIT_RESET' && transaction.isConsolidated) {
      if (showCompanyName && transaction.companyId?.name) {
        return `Reset de Credito - ${transaction.companyId.name}`;
      }
      return 'Reset de Credito Geral';
    }

    if (transaction.type === 'BATCH_DEPOSIT') {
      if (showCompanyName && transaction.companyId?.name) {
        return `Recarga em Lote - ${transaction.companyId.name}`;
      }
      return 'Recarga em Lote';
    }

    // Get name from employee or CPF user
    const holderName = transaction.employeeId?.name || transaction.cpfUserId?.name;

    if (holderName) {
      if (showCompanyName && transaction.companyId?.name) {
        return `${holderName} - ${transaction.companyId.name}`;
      }
      if (transaction.cpfUserId && !transaction.employeeId) {
        return `${holderName} (CPF)`;
      }
      return holderName;
    }

    return 'Usuario';
  };

  return (
    <Card variant="flat" className="overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-brand-cream-dark bg-brand-cream/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-brand-green-dark min-w-[140px] text-center">
          {MONTHS[currentMonth]} {currentYear}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS_SHORT.map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-brand-green-light py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map(i => (
            <div key={`empty-${i}`} className="h-9" />
          ))}
          {days.map(day => {
            const isToday =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear();
            const hasActivity = hasTransactions(day);
            const stats = getDayStats(day);
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'h-9 rounded-lg flex flex-col items-center justify-center text-xs relative transition-all duration-200',
                  isToday && !isSelected && 'ring-2 ring-brand-terracotta ring-offset-1',
                  isSelected && 'bg-brand-green-dark text-brand-cream shadow-brand-sm',
                  !isSelected && hasActivity && 'bg-brand-cream hover:bg-brand-cream-dark',
                  !isSelected && !hasActivity && 'hover:bg-brand-cream/50 text-brand-green-dark'
                )}
              >
                <span className={cn(isSelected && 'font-semibold')}>{day}</span>
                {hasActivity && !isSelected && (
                  <div className="flex gap-0.5 absolute bottom-1">
                    {stats.deposits > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                    {stats.consumes > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta" />
                    )}
                    {stats.resets > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day transactions */}
        <div className="mt-4 pt-4 border-t border-brand-cream-dark">
          <h4 className="font-semibold text-sm text-brand-green-dark mb-3">
            {selectedDay} de {MONTHS[currentMonth]}
          </h4>
          {selectedDayTransactions.length === 0 ? (
            <p className="text-sm text-brand-green-light py-4 text-center">
              Nenhuma transação neste dia
            </p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
              {selectedDayTransactions.map(transaction => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border border-brand-cream-dark bg-white p-3 text-sm hover:shadow-brand-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
                      getTransactionBgColor(transaction.type, transaction.amount)
                    )}>
                      {getTransactionIcon(transaction.type, transaction.amount, transaction.isConsolidated)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-brand-green-dark truncate">
                        {getDisplayName(transaction)}
                      </p>
                      <p className="text-xs text-brand-green-light truncate">
                        {transaction.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {transaction.type !== 'CREDIT_RESET' && (
                      <p className={cn(
                        'font-semibold',
                        transaction.amount > 0 && 'text-emerald-600',
                        transaction.amount < 0 && 'text-brand-terracotta'
                      )}>
                        {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </p>
                    )}
                    <p className="text-xs text-brand-green-light">
                      {new Date(transaction.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
