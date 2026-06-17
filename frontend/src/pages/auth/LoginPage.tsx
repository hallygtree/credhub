import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoFull, LogoSymbol } from '@/components/ui/logo';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { getRoleDefaultRoute } from '@/lib/utils';

const loginSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data.email, data.password);

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);

        // Check if password change is required
        if (parsedUser.mustChangePassword) {
          navigate('/change-password');
          return;
        }

        navigate(getRoleDefaultRoute(parsedUser.role));
      }
    } catch {
      setError('Credenciais invalidas. Tente novamente.');
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
              Uma pausa consciente, feita com sabor e intenção.
            </h1>
            <p className="text-brand-cream/70 text-lg leading-relaxed">
              Comer bem é uma escolha estratégica. No CredHub, a rotina não engole o prazer.
              A pausa certa pode recarregar o corpo, clarear a mente e manter você no controle do seu dia.
            </p>
          </div>

          {/* Footer */}
          <div className="text-brand-cream/50 text-sm">
            <p>CredHub</p>
            <p className="mt-1">Duo Corporate Towers - DCT | Seg a Sex | 8h às 18h</p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-brand-cream">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <LogoSymbol variant="inverse" size="xl" className="mb-4" />
            <h1 className="text-2xl font-semibold text-brand-green-dark">CredHub</h1>
            <p className="text-brand-green-light font-script text-lg">Sistema de crédito corporativo</p>
          </div>

          {/* Login form */}
          <div className="bg-white rounded-2xl shadow-brand-lg p-8 sm:p-10 border border-brand-cream-dark">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-brand-green-dark mb-2">
                Bem-vindo de volta
              </h2>
              <p className="text-brand-green-light">
                Entre com suas credenciais para acessar
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" required>Email corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@empresa.com"
                  icon={<Mail className="h-5 w-5" />}
                  error={!!errors.email}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" required>Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock className="h-5 w-5" />}
                  error={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? 'Entrando...' : 'Entrar no sistema'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-cream-dark" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-brand-green-light">
                  Precisa de ajuda?
                </span>
              </div>
            </div>

            {/* Help text */}
            <p className="text-center text-sm text-brand-green-light">
              Entre em contato com o administrador da sua empresa
              para obter suas credenciais de acesso.
            </p>

            {/* Register link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-brand-green-light">
                Nao tem uma conta?{' '}
                <Link to="/register" className="text-brand-terracotta hover:underline font-medium">
                  Cadastre-se aqui
                </Link>
              </p>
            </div>
          </div>

          {/* Footer - Mobile */}
          <p className="lg:hidden text-center text-sm text-brand-green-light mt-8">
            CredHub
          </p>
        </div>
      </div>
    </div>
  );
}
