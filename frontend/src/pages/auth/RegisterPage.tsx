import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerCpfUser } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoFull, LogoSymbol } from '@/components/ui/logo';
import { User, Phone, CreditCard, Calendar, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(100, 'Nome muito longo'),
  phone: z.string().min(10, 'Telefone deve ter no minimo 10 digitos').max(15, 'Telefone muito longo'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 digitos (apenas numeros)'),
  birthDate: z.string().min(1, 'Data de nascimento e obrigatoria'),
  email: z.string().email('Email invalido'),
  password: z
    .string()
    .min(8, 'A senha deve ter no minimo 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiuscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minuscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um numero')
    .regex(/[^A-Za-z0-9]/, 'A senha deve conter pelo menos um caractere especial'),
  confirmPassword: z.string().min(1, 'Confirmacao de senha e obrigatoria'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas nao coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      const { confirmPassword, ...registerData } = data;
      const response = await registerCpfUser(registerData);

      if (response.success && response.data) {
        // Store token and user
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        setSuccess(true);

        // Redirect after success message
        setTimeout(() => {
          navigate('/app/user/dashboard');
        }, 2000);
      } else {
        setError(response.error || 'Erro ao realizar cadastro');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao realizar cadastro. Verifique os dados.';
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
              Junte-se a nos
            </h1>
            <p className="text-brand-cream/70 text-lg leading-relaxed">
              Crie sua conta e tenha acesso a beneficios exclusivos.
              Sistema de crédito corporativo.
            </p>
          </div>

          {/* Footer */}
          <div className="text-brand-cream/50 text-sm">
            <p>Sistema de Cartao de Fidelidade</p>
          </div>
        </div>
      </div>

      {/* Right side - Register form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-brand-cream overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <LogoSymbol variant="inverse" size="xl" className="mb-4" />
            <h1 className="text-2xl font-semibold text-brand-green-dark">CredHub</h1>
            <p className="text-brand-green-light font-script text-lg">Sistema de crédito corporativo</p>
          </div>

          {/* Register form */}
          <div className="bg-white rounded-2xl shadow-brand-lg p-8 sm:p-10 border border-brand-cream-dark">
            <div className="mb-6">
              <Link
                to="/login"
                className="inline-flex items-center text-sm text-brand-green-light hover:text-brand-terracotta transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar para login
              </Link>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-brand-green-dark mb-2">
                Criar conta
              </h2>
              <p className="text-brand-green-light">
                Preencha seus dados para se cadastrar
              </p>
            </div>

            {success ? (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-brand-green-dark mb-2">
                  Cadastro realizado com sucesso!
                </h3>
                <p className="text-brand-green-light">
                  Redirecionando...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name" required>Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    icon={<User className="h-5 w-5" />}
                    error={!!errors.name}
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf" required>CPF</Label>
                    <Input
                      id="cpf"
                      type="text"
                      placeholder="12345678909"
                      icon={<CreditCard className="h-5 w-5" />}
                      error={!!errors.cpf}
                      maxLength={11}
                      {...register('cpf')}
                    />
                    {errors.cpf && (
                      <p className="text-sm text-red-600">{errors.cpf.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" required>Telefone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="11999999999"
                      icon={<Phone className="h-5 w-5" />}
                      error={!!errors.phone}
                      {...register('phone')}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-600">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate" required>Data de nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    icon={<Calendar className="h-5 w-5" />}
                    error={!!errors.birthDate}
                    {...register('birthDate')}
                  />
                  {errors.birthDate && (
                    <p className="text-sm text-red-600">{errors.birthDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" required>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
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
                    placeholder="Minimo 8 caracteres"
                    icon={<Lock className="h-5 w-5" />}
                    error={!!errors.password}
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password.message}</p>
                  )}
                  <p className="text-xs text-brand-green-light">
                    Minimo 8 caracteres, com letra maiuscula, minuscula, numero e caractere especial
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" required>Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirme sua senha"
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
                  className="w-full h-12 text-base mt-6"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Cadastrando...' : 'Criar conta'}
                </Button>
              </form>
            )}
          </div>

          {/* Footer - Mobile */}
          <p className="lg:hidden text-center text-sm text-brand-green-light mt-8">
            Sistema de Cartao de Fidelidade
          </p>
        </div>
      </div>
    </div>
  );
}
