import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { changePassword } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoFull, LogoSymbol } from '@/components/ui/logo';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { getRoleDefaultRoute } from '@/lib/utils';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z
    .string()
    .min(8, 'A nova senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
    .regex(/[^A-Za-z0-9]/, 'A senha deve conter pelo menos um caractere especial'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setError(null);
      const response = await changePassword(data);

      if (response.success && response.data) {
        // Update token
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }

        // Update user state
        if (response.data.user) {
          updateUser(response.data.user);
        }

        setSuccess(true);

        // Redirect after success message
        setTimeout(() => {
          const userRole = response.data?.user?.role || user?.role;
          if (userRole) {
            navigate(getRoleDefaultRoute(userRole));
          } else {
            navigate('/app/company/overview');
          }
        }, 2000);
      } else {
        setError(response.error || 'Erro ao alterar senha');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao alterar senha. Verifique a senha atual.';
      setError(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-green-dark relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 border border-brand-cream rounded-full" />
          <div className="absolute bottom-20 right-20 w-96 h-96 border border-brand-cream rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-brand-cream rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <LogoFull variant="inverse" size="lg" />

          {/* Main message */}
          <div className="max-w-md">
            <h1 className="text-4xl font-semibold text-brand-cream mb-6 leading-tight">
              Seguranca em primeiro lugar
            </h1>
            <p className="text-brand-cream/70 text-lg leading-relaxed">
              Por favor, altere sua senha para continuar. Esta e uma medida de seguranca
              para proteger sua conta.
            </p>
          </div>

          {/* Footer */}
          <div className="text-brand-cream/50 text-sm">
            <p>Sistema de Cartao de Fidelidade Corporativo</p>
          </div>
        </div>
      </div>

      {/* Right side - Change password form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-brand-cream">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <LogoSymbol variant="inverse" size="xl" className="mb-4" />
            <h1 className="text-2xl font-semibold text-brand-green-dark">CredHub</h1>
            <p className="text-brand-green-light font-script text-lg">Sistema de crédito corporativo</p>
          </div>

          {/* Change password form */}
          <div className="bg-white rounded-2xl shadow-brand-lg p-8 sm:p-10 border border-brand-cream-dark">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-brand-green-dark mb-2">
                Alterar Senha
              </h2>
              <p className="text-brand-green-light">
                Por motivos de seguranca, voce precisa criar uma nova senha
              </p>
            </div>

            {success ? (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-brand-green-dark mb-2">
                  Senha alterada com sucesso!
                </h3>
                <p className="text-brand-green-light">
                  Redirecionando...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="currentPassword" required>Senha atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Digite sua senha atual"
                    icon={<Lock className="h-5 w-5" />}
                    error={!!errors.currentPassword}
                    {...register('currentPassword')}
                  />
                  {errors.currentPassword && (
                    <p className="text-sm text-red-600">{errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" required>Nova senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Digite sua nova senha"
                    icon={<Lock className="h-5 w-5" />}
                    error={!!errors.newPassword}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p className="text-sm text-red-600">{errors.newPassword.message}</p>
                  )}
                  <p className="text-xs text-brand-green-light">
                    Minimo 8 caracteres, com letra maiuscula, minuscula, numero e caractere especial
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" required>Confirmar nova senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirme sua nova senha"
                    icon={<Lock className="h-5 w-5" />}
                    error={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Alterando...' : 'Alterar senha'}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={logout}
                    className="text-sm text-brand-green-light hover:text-brand-terracotta transition-colors"
                  >
                    Sair e voltar para o login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
