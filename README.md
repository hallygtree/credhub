# CredHub

![Projeto de estudo](https://img.shields.io/badge/projeto-de%20estudo-orange)

> [!WARNING]
> **Este é um projeto puramente de estudo.** Foi criado para praticar desenvolvimento full-stack (autenticação, RBAC, transações, integração de pagamentos e testes). Não é um produto e nenhuma empresa o usa. Não processa pagamentos reais e não deve ser usado em produção. Empresas, pessoas, CNPJs, CPFs e credenciais citados aqui são fictícios.

Projeto de estudo de um sistema de crédito corporativo para empresas e usuários individuais. Empresas parceiras gerenciam o saldo de crédito dos seus colaboradores. Usuários avulsos também podem se cadastrar diretamente via CPF e recarregar saldo via Pix (sandbox do Mercado Pago).

---

## Sumário

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Papéis e Controle de Acesso (RBAC)](#papéis-e-controle-de-acesso-rbac)
- [Modelo de Dados](#modelo-de-dados)
- [API Endpoints](#api-endpoints)
- [Rotas do Frontend](#rotas-do-frontend)
- [Integração com Mercado Pago (PIX)](#integração-com-mercado-pago-pix)
- [Segurança](#segurança)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Instalação e Execução](#instalação-e-execução)
- [Testes](#testes)
- [Credenciais de Demo](#credenciais-de-demo)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

O **CredHub** é um projeto de estudo que simula uma plataforma web de gestão de créditos corporativos. Possui dois modelos de uso:

1. **Modelo Corporativo:** Empresas parceiras cadastram seus colaboradores. O gestor da empresa (COMPANY_VIEWER) recarrega saldo via Pix para um ou múltiplos colaboradores de uma só vez. Os colaboradores utilizam o saldo via cartão de acesso ou CPF.

2. **Modelo Avulso (CPF):** Usuários individuais se cadastram com CPF, recarregam seu próprio saldo via Pix e utilizam o saldo no estabelecimento parceiro.

O super administrador gerencia todo o ecossistema: cadastra empresas, cria usuários gestores, ajusta saldos manualmente, registra consumos via número do cartão, e acompanha todas as transações do sistema.

---

## Tecnologias

### Backend

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| Node.js | 18+ | Runtime |
| Express | ^4.21 | Framework HTTP |
| TypeScript | ^5.6 | Tipagem estática |
| MongoDB | 7+ | Banco de dados (replica set `rs0` exigido para transações) |
| Mongoose | ^8.7 | ODM para MongoDB |
| JSON Web Token | ^9.0 | Autenticação stateless |
| bcryptjs | ^2.4 | Hash de senhas |
| Zod | ^3.23 | Validação de schemas |
| Axios | ^1.13 | Cliente HTTP (Mercado Pago) |
| express-rate-limit | ^7.4 | Rate limiting |
| Helmet | ^8.0 | Headers de segurança HTTP |
| CORS | ^2.8 | Cross-Origin Resource Sharing |
| Pino | ^9.4 | Logging estruturado JSON |
| Jest + ts-jest | — | Testes unitários |
| mongodb-memory-server | — | MongoDB em memória para testes |

### Frontend

| Tecnologia | Versão | Finalidade |
|------------|--------|------------|
| React | ^19.2 | Framework de UI |
| TypeScript | ^5.9 | Tipagem estática |
| Vite | ^7.2 | Build tool e dev server |
| React Router | ^7.13 | Roteamento SPA |
| TanStack Query | ^5.90 | Cache e gerenciamento de estado do servidor |
| React Hook Form | ^7.71 | Gerenciamento de formulários |
| Zod | ^4.3 | Validação de schemas (frontend) |
| Tailwind CSS | ^3.4 | Estilização utilitária |
| shadcn/ui + Radix UI | — | Componentes acessíveis |
| Lucide React | ^0.563 | Ícones SVG |
| class-variance-authority | — | Variantes de componentes |
| Vitest + React Testing Library | ^4.0 | Testes unitários e de componentes |
| happy-dom | ^20.7 | Ambiente DOM leve para testes |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  Vite · React Router · TanStack Query · shadcn/ui        │
│  http://localhost:5173                                   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / REST (JSON)
┌────────────────────▼────────────────────────────────────┐
│                   Backend (Express + TS)                  │
│  JWT Auth · Zod Validation · RBAC Middleware             │
│  http://localhost:3001/api                               │
└──────┬──────────────────────────────────────┬───────────┘
       │                                      │
┌──────▼──────┐                    ┌──────────▼──────────┐
│   MongoDB   │                    │  Mercado Pago API   │
│  Replica Set│                    │  Orders API (PIX)   │
│  (rs0)      │                    └─────────────────────┘
└─────────────┘
```

O backend segue uma arquitetura em camadas:

- **Routes** → definem os endpoints e aplicam middlewares
- **Controllers** → recebem a request, validam com Zod, delegam para services
- **Services** → contêm a lógica de negócio
- **Models** → schemas Mongoose com transformações JSON compartilhadas
- **Middlewares** → autenticação JWT, RBAC, rate limiting, error handling
- **Validators** → schemas Zod reutilizáveis por camada
- **Utils** → respostas padronizadas, erros HTTP tipados, logger

---

## Funcionalidades

### Super Administrador

- **Dashboard geral** com visão consolidada: total de empresas, colaboradores ativos, usuários CPF, volume de transações e recargas do mês
- **Gestão de assinantes:** lista unificada de empresas e usuários CPF com filtros por tipo; ambos têm link "Ver detalhes"
- **Cadastro de empresas:** cria a empresa (nome, CNPJ, e-mail, telefone, endereço) e o usuário gestor (COMPANY_VIEWER) simultaneamente
- **Edição de empresas:** atualiza dados da empresa e credenciais do gestor (nome, e-mail, senha)
- **Página de detalhes da empresa:** visualiza colaboradores da empresa, histórico de transações e calendário de recargas mensais
- **Página de detalhes do usuário CPF:** visualiza informações pessoais (nome, CPF mascarado, e-mail, saldo), calendário de atividade com as últimas transações e número do cartão de acesso editável diretamente na página
- **Gestão de colaboradores (admin):** edita dados, ativa/inativa, ajusta saldo manualmente, atribui número de cartão
- **Compra por cartão:** busca portador pelo número do cartão (parcial, sem exibir usuários sem cartão) e registra consumo com valor e descrição
- **Atribuição de cartões:** vincula número de cartão a usuários CPF

### Gestor (COMPANY_VIEWER)

- **Dashboard da empresa** com calendário de atividade de recargas
- **Lista de colaboradores** com busca por nome e paginação
- **Cadastro de colaborador:** cria o registro do colaborador e o usuário de acesso (e-mail + senha) em um único formulário
- **Detalhes do colaborador:** visualiza histórico de transações, saldo atual e dados pessoais
- **Recarga de saldo via PIX:** seleciona um ou múltiplos colaboradores, define valor por colaborador e gera um pagamento PIX unificado. Ao ser aprovado, o saldo é creditado individualmente para cada colaborador selecionado
- **Exclusão de colaborador:** remove o colaborador e seu histórico

### Colaborador (EMPLOYEE)

- **Dashboard pessoal** com saldo disponível e cartão de acesso
- **Edição de perfil:** nome, telefone, endereço, CEP, e-mail e senha
- **Histórico de transações:** lista paginada com tipo (depósito/consumo/reset), valor, saldo resultante e data
- **Cartão de acesso:** exibe o número do cartão de acesso. Se não cadastrado, exibe instruções para solicitação

### Usuário CPF (CPF_USER)

- **Cadastro público** via `/register` com nome, CPF, data de nascimento, e-mail, telefone e senha
- **Mesmas funcionalidades do EMPLOYEE** para dashboard, perfil e histórico
- **Recarga de saldo via PIX** diretamente pela tela de pagamento com valores pré-definidos (R$ 20, 50, 100, 200) ou valor livre
- **Cartão de acesso:** exibe o número do cartão ou instruções para obtenção

### Fluxo de Primeiro Acesso

Todos os usuários criados pelo sistema (gestores, colaboradores) são forçados a trocar a senha no primeiro login. O campo `mustChangePassword` é verificado em todas as rotas protegidas — usuários com senha pendente são redirecionados para `/change-password` e não conseguem acessar nenhuma outra rota até concluir a troca.

### Pagamento PIX

- Geração de QR Code e código **copia e cola** (EMV string) via Mercado Pago Orders API
- Exibição do QR Code em base64 e campo de texto com botão de copiar
- **Polling automático** a cada 5 segundos verificando o status do pagamento
- Ao confirmar pagamento: crédito automático no saldo do(s) usuário(s), registro no ledger de transações e redirecionamento para o dashboard
- Webhook do Mercado Pago para confirmação assíncrona com validação de assinatura HMAC SHA256
- Idempotência: pagamentos já processados não são creditados novamente

---

## Papéis e Controle de Acesso (RBAC)

| Papel | Identificador | Acesso |
|-------|--------------|--------|
| Super Administrador | `SUPER_ADMIN` | Acesso total ao sistema. Gerencia empresas, colaboradores, usuários CPF, saldos e compras |
| Gestor de Empresa | `COMPANY_VIEWER` | Acesso somente aos dados da própria empresa. Cadastra colaboradores e recarrega saldos via PIX |
| Colaborador | `EMPLOYEE` | Acesso ao próprio perfil, saldo e histórico de transações |
| Usuário CPF | `CPF_USER` | Acesso ao próprio perfil, saldo, histórico e recarga via PIX |

O middleware de RBAC é aplicado por rota. Além do papel, o `companyId` é usado para isolar dados entre empresas diferentes — um gestor só enxerga os colaboradores da sua empresa.

---

## Modelo de Dados

### User
```
email          String  único, obrigatório
password       String  hash bcrypt, mín. 8 chars
name           String  máx. 100 chars
role           Enum    SUPER_ADMIN | COMPANY_VIEWER | EMPLOYEE | CPF_USER
companyId      ObjectId → Company  (COMPANY_VIEWER, EMPLOYEE)
employeeId     ObjectId → Employee (EMPLOYEE)
isActive       Boolean padrão: true
mustChangePassword Boolean padrão: true
lastLogin      Date    opcional
--- Campos exclusivos CPF_USER ---
cpf            String  11 dígitos, único sparse
phone          String  opcional
birthDate      Date    opcional
balance        Number  padrão: 0, mín: 0
address        String  opcional
zipCode        String  opcional
cardNumber     String  único sparse, opcional
```

### Company
```
name           String  obrigatório, máx. 100 chars
cnpj           String  único, 14 dígitos
email          String  único, obrigatório
phone          String  opcional
address        String  opcional, máx. 200 chars
isActive       Boolean padrão: true
```

### Employee
```
name           String   obrigatório, máx. 100 chars
email          String   único, obrigatório
cpf            String   único, 11 dígitos
companyId      ObjectId → Company, obrigatório
balance        Number   padrão: 0, mín: 0
monthlyAllowance Number padrão: 0
isActive       Boolean  padrão: true
cardNumber     String   único sparse, opcional
phone          String   opcional
address        String   opcional
zipCode        String   opcional
```

### LedgerTransaction
```
employeeId     ObjectId → Employee (ou cpfUserId)
cpfUserId      ObjectId → User
companyId      ObjectId → Company (opcional)
type           Enum     DEPOSIT | CONSUME | CREDIT_RESET
amount         Number   obrigatório
balanceBefore  Number   obrigatório
balanceAfter   Number   obrigatório
description    String   máx. 500 chars
performedBy    ObjectId → User
idempotencyKey String   único sparse (evita duplicatas)
batchId        String   opcional (agrupa operações em lote)
metadata       Mixed    dados adicionais
createdAt      Date     automático
```

### Payment
```
userId         ObjectId → User, obrigatório
role           Enum     UserRole
amount         Number   mín: 0.01
amountPerEmployee Number opcional (pagamento em lote)
employeeIds    [ObjectId] → Employee (pagamento em lote)
provider       String   padrão: mercadopago
providerPaymentId String único sparse (ID do pedido no MP)
status         Enum     pending | approved | rejected | expired | cancelled
qrCode         String   código PIX EMV (copia e cola)
qrCodeBase64   String   imagem QR Code em base64
copiaECola     String   alias do qrCode
ticketUrl      String   URL da página de pagamento
expirationTime Date     opcional
creditedAt     Date     timestamp de quando o saldo foi creditado
```

### Wallet
```
ownerId        ObjectId → Employee | User, obrigatório
ownerType      Enum     EMPLOYEE | CPF_USER
balance        Number   padrão: 0, mín: 0
isActive       Boolean  padrão: true
```

### ProcessedWebhookEvent
```
eventId        String   ID único do evento (MP notification_id), único
processedAt    Date     timestamp de processamento
```

### AuditLog
```
action         String   ação executada (ex: EMPLOYEE_DELETED, BALANCE_ADJUSTED)
performedBy    ObjectId → User
targetId       ObjectId referência ao recurso afetado
targetModel    String   nome do model (Employee, User, etc.)
metadata       Mixed    dados adicionais da ação
createdAt      Date     automático
```

---

## API Endpoints

### Autenticação (`/api/auth`)

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `POST` | `/auth/login` | Público (rate limited) | Login com e-mail e senha. Retorna JWT e dados do usuário |
| `POST` | `/auth/register` | Público (rate limited) | Cadastro de usuário CPF com validação de CPF e senha forte |
| `GET` | `/auth/me` | Autenticado | Retorna perfil do usuário atual |
| `POST` | `/auth/change-password` | Autenticado | Troca de senha (obrigatória no primeiro acesso) |

### Admin (`/api/admin`) — Requer `SUPER_ADMIN`

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/admin/overview` | Estatísticas gerais do sistema |
| `GET` | `/admin/transactions` | Todas as transações (paginado) |
| `GET` | `/admin/subscribers` | Lista empresas + usuários CPF |
| `GET` | `/admin/cpf-users/:id` | Detalhes do usuário CPF (info + saldo + últimas 100 transações) |
| `PUT` | `/admin/cpf-users/:id/card` | Atribui número de cartão a usuário CPF |
| `GET` | `/admin/companies` | Lista todas as empresas |
| `POST` | `/admin/companies` | Cria empresa e usuário gestor |
| `GET` | `/admin/companies/:id` | Detalhes de uma empresa |
| `PUT` | `/admin/companies/:id` | Atualiza dados da empresa |
| `GET` | `/admin/companies/:id/employees` | Colaboradores da empresa (paginado + busca) |
| `GET` | `/admin/companies/:id/transactions` | Transações da empresa (paginado) |
| `GET` | `/admin/companies/:id/viewer` | Dados do usuário gestor |
| `PUT` | `/admin/companies/:id/viewer` | Atualiza gestor (nome, e-mail, senha) |
| `PUT` | `/admin/employees/:id` | Edita colaborador (nome, e-mail, cartão, ativo) |
| `POST` | `/admin/employees/:id/adjust-balance` | Ajuste manual de saldo |
| `GET` | `/admin/card/:cardNumber` | Busca portador pelo número do cartão (apenas portadores com cartão cadastrado) |
| `POST` | `/admin/purchase` | Registra compra pelo número do cartão |

### Company (`/api/company`) — Requer `COMPANY_VIEWER` + senha trocada

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/company/overview` | Dashboard da empresa com calendário |
| `GET` | `/company/employees` | Lista colaboradores (paginado + busca) |
| `POST` | `/company/employees` | Cria colaborador + usuário de acesso |
| `GET` | `/company/employees/:id` | Detalhes do colaborador |
| `DELETE` | `/company/employees/:id` | Remove colaborador |

### User (`/api/user`) — Requer `EMPLOYEE` ou `CPF_USER` + senha trocada

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/user/me` | Perfil completo (nome, saldo, cartão, empresa) |
| `PUT` | `/user/me` | Atualiza perfil (nome, telefone, endereço, e-mail, senha) |
| `GET` | `/user/transactions` | Histórico de transações (paginado) |

### Payments (`/api/payments`) — Requer autenticação + senha trocada

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `POST` | `/payments/pix` | CPF_USER, COMPANY_VIEWER (rate limited) | Cria pagamento PIX. CPF_USER recarrega o próprio saldo; COMPANY_VIEWER envia `amountPerEmployee` + `employeeIds[]` para recarga em lote |
| `GET` | `/payments/:id/status` | CPF_USER, EMPLOYEE, COMPANY_VIEWER | Consulta status e atualiza localmente |
| `GET` | `/payments` | CPF_USER, EMPLOYEE, COMPANY_VIEWER | Histórico de pagamentos do usuário (paginado) |

### Webhooks (`/api/webhooks`) — Sem autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/webhooks/mercadopago` | Recebe notificações do Mercado Pago. Valida assinatura HMAC SHA256 e processa aprovação/expiração |

### Health Check

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Status da API |

---

## Rotas do Frontend

```
/                               → Redirect baseado no papel do usuário
/login                          → Tela de login
/register                       → Cadastro de usuário CPF (público)
/change-password                → Troca de senha obrigatória (primeiro acesso)

/app/admin/overview             → Dashboard do super admin
/app/admin/subscribers          → Lista de assinantes (empresas + CPF)
/app/admin/subscribers/:id      → Detalhes da empresa (colaboradores, transações, calendário)
/app/admin/cpf-users/:id        → Detalhes do usuário CPF (info, calendário de transações, cartão editável)

/app/company/overview           → Dashboard do gestor (calendário de recargas)
/app/company/employees          → Gestão de colaboradores + recarga PIX em lote
/app/company/employees/:id      → Detalhes e histórico do colaborador

/app/user/dashboard             → Painel do colaborador / usuário CPF
/app/payments                   → Recarga via PIX (apenas CPF_USER)
```

**Proteção de rotas:**
- Rotas `/app/*` exigem JWT válido + `mustChangePassword === false`
- Rotas de admin exigem `role === SUPER_ADMIN`
- Rotas de company exigem `role === COMPANY_VIEWER`
- Rotas de user exigem `role === EMPLOYEE || role === CPF_USER`
- Rota de pagamentos (`/app/payments`) exige `role === CPF_USER` — EMPLOYEE não tem acesso à recarga PIX direta
- Usuários com senha pendente são redirecionados para `/change-password`

---

## Integração com Mercado Pago (PIX)

O sistema usa a **Orders API** do Mercado Pago (`POST /v1/orders`) para gerar pagamentos PIX.

### Fluxo completo

```
Frontend                Backend                Mercado Pago
   │                       │                        │
   │── POST /payments/pix ─►│                        │
   │                       │── POST /v1/orders ─────►│
   │                       │◄── order (qr_code) ─────│
   │◄── paymentId + QR ────│                        │
   │                       │                        │
   │ (polling a cada 5s)   │                        │
   │── GET /payments/:id ──►│                        │
   │         /status        │── GET /v1/orders/:id ─►│
   │                       │◄── status ──────────────│
   │◄── { status } ────────│                        │
   │                       │                        │
   │   (usuário paga PIX)  │                        │
   │                       │◄── POST /webhooks ──────│
   │                       │   (payment.updated)     │
   │                       │── credita saldo ────────│
   │                       │── salva creditedAt ─────│
   │◄── (polling detecta) ─│                        │
   │    status: approved    │                        │
   │── redirect dashboard ─►│                        │
```

### Configuração para testes

1. Crie duas contas de teste no [painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app): **Vendedor** e **Comprador**
2. Logue com a conta **Vendedor** no Mercado Pago e acesse o painel de desenvolvedor
3. Em **Credenciais de produção**, copie o **Access Token** (`APP_USR-...`)
4. Configure no `.env`:
   ```env
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...  # Token do vendedor de teste
   PIX_PAYER_EMAIL=email-do-comprador@testuser.com
   ```
5. Em modo de desenvolvimento, o sistema inclui automaticamente `first_name: "APRO"` no pagador, o que faz o Mercado Pago aprovar o pagamento automaticamente em sandbox

### Campos retornados pela API

| Campo MP | Campo interno | Conteúdo |
|----------|--------------|----------|
| `qr_code` | `copiaECola` | String EMV para copia e cola |
| `qr_code_base64` | `qrCodeBase64` | Imagem do QR Code em base64 |
| `ticket_url` | `ticketUrl` | Link da página de pagamento |

---

## Segurança

| Mecanismo | Implementação |
|-----------|--------------|
| Autenticação | JWT com expiração configurável (padrão: 8h) |
| Senhas | Hash bcrypt com 12 rounds de salt |
| Validação | Schemas Zod em todos os inputs (backend e frontend) |
| Rate Limiting | 5 tentativas de login por 15 min; 100 req gerais por 15 min; limite específico para PIX |
| Headers HTTP | Helmet com configurações padrão (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Origem configurável via `CORS_ORIGIN` |
| RBAC | Middleware por rota com verificação de papel e `companyId` |
| Isolamento de dados | Queries sempre filtradas por `companyId` do usuário autenticado |
| Webhook | Validação de assinatura HMAC SHA256 (`x-signature` header do Mercado Pago) |
| Idempotência | Chave única por pagamento evita duplo crédito em caso de retry |
| Mascaramento | CPF: `***.456.***-01` (oculta primeiros 3 e 3 antes do hífen); CNPJ: `**.345.***/0001-00` (oculta primeiros 2 e 3º grupo antes da barra) |
| Logs | Pino com logs estruturados em JSON; sem exposição de dados sensíveis |
| Primeiro acesso | Troca de senha obrigatória bloqueada por middleware |
| Transações atômicas | `session.withTransaction()` do MongoDB garante atomicidade nos débitos de saldo e registros no ledger |

---

## Variáveis de Ambiente

Crie o arquivo `backend/.env` baseado no seguinte modelo:

```env
# ── Aplicação ──────────────────────────────────────────
NODE_ENV=development          # development | production | test
PORT=3001
CORS_ORIGIN=http://localhost:5173

# ── Banco de Dados ─────────────────────────────────────
# Replica set obrigatório para suporte a transações MongoDB
MONGODB_URI=mongodb://localhost:27017/credhub?replicaSet=rs0&directConnection=true

# ── Autenticação JWT ───────────────────────────────────
JWT_SECRET=sua_chave_secreta_com_minimo_32_caracteres
JWT_EXPIRES_IN=8h

# ── Rate Limiting ──────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000        # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_REQUESTS=5

# ── Logs ───────────────────────────────────────────────
LOG_LEVEL=info    # trace | debug | info | warn | error | fatal

# ── Mercado Pago / PIX ─────────────────────────────────
# Access Token de PRODUÇÃO da conta de teste vendedor (começa com APP_USR-)
# Obtenha em: conta de teste vendedor > Painel Dev > Credenciais de produção
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...

# Email da conta de teste COMPRADOR (gerado pelo Mercado Pago)
PIX_PAYER_EMAIL=email-comprador@testuser.com

# Valor máximo por transação PIX (em reais)
PIX_MAX_AMOUNT=5000

# Segredo do webhook (configure em produção; vazio = validação ignorada em dev)
MERCADO_PAGO_WEBHOOK_SECRET=
```

---

## Instalação e Execução

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose

### Opção 1: Script automatizado

```bash
git clone <repo-url>
cd credhub
./start.sh    # Sobe MongoDB, instala dependências e inicia backend + frontend
./stop.sh     # Para tudo
```

### Opção 2: Manual

#### 1. Subir o MongoDB

O sistema usa transações do MongoDB (`session.withTransaction`) que exigem **replica set**. O `docker-compose.yml` sobe o MongoDB com `--replSet rs0` e um serviço auxiliar `mongo-setup` que inicializa o replica set automaticamente. A autenticação está desabilitada no ambiente de desenvolvimento para evitar a necessidade de `keyFile`.

```bash
docker compose up -d
# Aguarde ~10s para o replica set ser inicializado pelo mongo-setup
```

#### 2. Configurar e iniciar o Backend

```bash
cd backend
cp .env.example .env    # Configure as variáveis de ambiente
npm install
npm run seed            # Cria o SUPER_ADMIN e dados de demonstração
npm run dev             # Servidor em http://localhost:3001
```

#### 3. Iniciar o Frontend

```bash
cd frontend
npm install
npm run dev             # Interface em http://localhost:5173
```

#### 4. Build de produção (local)

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build   # Gera dist/ para servir com Nginx ou similar
```

### Opção 3: Docker Compose (setup de produção)

> Incluído como exercício de deploy. O projeto não está rodando em produção em lugar nenhum.

```bash
# Configure as variáveis de ambiente necessárias
cp backend/.env.example backend/.env
# (edite backend/.env com as credenciais de produção)

# Sobe toda a stack: MongoDB, Backend, Frontend e Nginx reverso
docker compose -f docker-compose.prod.yml up -d

# Acompanhar logs
docker compose -f docker-compose.prod.yml logs -f
```

A stack de produção expõe a aplicação na porta `80` via Nginx:
- `/api/*` → backend (Express, porta 3001)
- `/*` → frontend (React/Nginx, porta 80 interna)

---

## Testes

### Backend (Jest + ts-jest + mongodb-memory-server)

Testes unitários isolados — o MongoDB em memória é iniciado automaticamente, sem dependência de banco externo.

> **Atenção:** testes que envolvem transações atômicas (`adjustBalance`, `registerPurchaseByCard`) requerem `MongoMemoryReplSet` em vez de `MongoMemoryServer`.

```bash
cd backend
npm test              # Roda todos os testes
npm test -- --watch  # Modo watch
npm run test:coverage # Cobertura de código
```

Arquivos de teste em `src/__tests__/`:

| Arquivo | O que cobre |
|---------|-------------|
| `auth.test.ts` | registerCpfUser, login, changePassword, getCurrentUser, generateRandomPassword |
| `wallet.test.ts` | getOrCreateWallet (idempotência), creditWallet, debitWallet, deactivateWallet, getWalletBalance |
| `employee.test.ts` | createEmployee, deleteEmployee (soft-delete), adjustBalance, reloadSelectedBalances |
| `middleware.test.ts` | authenticate (JWT), requirePasswordChanged, requireRole (todos os papéis + cenários PIX) |
| `payment.test.ts` | createPixPayment, getPaymentStatus, processWebhookApproval (idempotência) |

### Frontend (Vitest + React Testing Library + happy-dom)

```bash
cd frontend
npm run test:run      # Roda todos os testes (modo CI)
npm test              # Modo watch interativo
npm run test:coverage # Cobertura de código
```

Arquivos de teste em `src/__tests__/`:

| Arquivo | O que cobre |
|---------|-------------|
| `utils.test.ts` | formatCurrency, formatDate, formatDateOnly, formatCPF, formatCNPJ, parseBrazilianNumber, getRoleDefaultRoute |
| `ProtectedRoute.test.tsx` | Loading spinner, redirect não autenticado, acesso por papel (SUPER_ADMIN, EMPLOYEE, CPF_USER, COMPANY_VIEWER), bloqueio EMPLOYEE na rota PIX |

---

## Credenciais de Demo

Todos os dados abaixo são fictícios. Após executar `npm run seed` no backend, os seguintes usuários são criados com dados históricos de novembro/2025 a fevereiro/2026:

### Super Admin

| E-mail | Senha |
|--------|-------|
| admin@restaurant.com | Admin@123456 |

### Empresa Demo LTDA (CNPJ: 12.345.678/0001-34)

| Papel | E-mail | Senha | Cartão |
|-------|--------|-------|--------|
| Gestor (COMPANY_VIEWER) | empresa@demo.com | Empresa@123456 | — |
| Colaborador (EMPLOYEE) | joao@demo.com | Joao@123456 | CARD001 |
| Colaborador (EMPLOYEE) | maria@demo.com | Maria@123456 | CARD002 |
| Colaborador (EMPLOYEE) | pedro@demo.com | Pedro@123456 | CARD003 |

### Tech Solutions (CNPJ: 98.765.432/1000-01)

| Papel | E-mail | Senha | Cartão |
|-------|--------|-------|--------|
| Gestor (COMPANY_VIEWER) | techviewer@demo.com | TechViewer@123456 | — |
| Colaborador (EMPLOYEE) | ana@demo.com | Ana@123456 | CARD004 |
| Colaborador (EMPLOYEE) | carlos@demo.com | Carlos@123456 | CARD005 |

### Usuário CPF Avulso

| Papel | E-mail | Senha | CPF | Cartão |
|-------|--------|-------|-----|--------|
| CPF_USER | cpf.demo@teste.com | CpfDemo@123456 | 123.456.789-09 | CARD006 |

### Pagamentos PIX Pendentes (para simulação)

| ID do Pedido | Valor | Referência |
|-------------|-------|-----------|
| ORD-C1-PENDING-MAR2026 | R$ 1.200,00 | Recarga em lote (Empresa Demo) |
| ORD-CPF-PENDING-FEB2026 | R$ 250,00 | Recarga avulsa (cpf.demo) |

> Os usuários de demonstração são criados com `mustChangePassword: false` para facilitar o acesso imediato no ambiente de desenvolvimento.

---

## Estrutura do Projeto

```
credhub/
├── docker-compose.yml          # MongoDB replica set rs0 sem auth (desenvolvimento)
├── docker-compose.prod.yml     # Stack completa em produção (backend + frontend + nginx + mongo)
├── nginx.conf                  # Nginx reverso para produção (roteia /api → backend, / → frontend)
├── mongo-init.js               # Script de inicialização do MongoDB
├── start.sh                    # Script de inicialização completa (desenvolvimento)
├── stop.sh                     # Script para parar a aplicação (desenvolvimento)
│
├── backend/
│   ├── Dockerfile              # Imagem de produção do backend
│   ├── src/
│   │   ├── __tests__/          # Testes unitários
│   │   │   ├── auth.test.ts
│   │   │   ├── employee.test.ts
│   │   │   ├── middleware.test.ts
│   │   │   ├── payment.test.ts
│   │   │   └── wallet.test.ts
│   │   ├── config/
│   │   │   ├── env.ts          # Validação e exportação de variáveis de ambiente (Zod)
│   │   │   └── database.ts     # Conexão com MongoDB + sincronização de índices
│   │   ├── controllers/        # Handlers de request/response
│   │   │   ├── adminController.ts
│   │   │   ├── authController.ts
│   │   │   ├── companyController.ts
│   │   │   ├── employeeController.ts
│   │   │   ├── paymentController.ts
│   │   │   ├── userController.ts
│   │   │   └── index.ts
│   │   ├── dto/
│   │   │   └── employee.ts     # Data Transfer Objects
│   │   ├── middlewares/
│   │   │   ├── auth.ts         # Verificação JWT + extração de user
│   │   │   ├── rbac.ts         # Controle de acesso por papel
│   │   │   ├── errorHandler.ts # Handler global de erros
│   │   │   ├── requestId.ts    # Middleware de request ID (rastreabilidade)
│   │   │   ├── pixRateLimiter.ts
│   │   │   └── index.ts
│   │   ├── migrations/         # Scripts de migração de banco de dados
│   │   ├── models/
│   │   │   ├── AuditLog.ts     # Log de auditoria de ações administrativas
│   │   │   ├── Company.ts
│   │   │   ├── Employee.ts
│   │   │   ├── LedgerTransaction.ts
│   │   │   ├── Payment.ts
│   │   │   ├── ProcessedWebhookEvent.ts  # Idempotência de webhooks
│   │   │   ├── User.ts
│   │   │   ├── Wallet.ts       # Carteira financeira (fonte única de verdade do saldo)
│   │   │   ├── schemaOptions.ts
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── adminRoutes.ts
│   │   │   ├── authRoutes.ts
│   │   │   ├── companyRoutes.ts
│   │   │   ├── employeeRoutes.ts
│   │   │   ├── paymentRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   └── webhookRoutes.ts
│   │   ├── services/
│   │   │   ├── adminService.ts        # Overview, subscribers, CPF user detail, compras por cartão
│   │   │   ├── authService.ts
│   │   │   ├── companyService.ts
│   │   │   ├── employeeService.ts
│   │   │   ├── mercadoPagoService.ts  # Integração Orders API
│   │   │   ├── paymentService.ts      # Lógica PIX + crédito de saldo
│   │   │   ├── userService.ts
│   │   │   ├── walletService.ts       # Operações de carteira (crédito, débito, saldo)
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── audit.ts        # Helper para registro de auditoria
│   │   │   ├── errors.ts       # Classes de erro HTTP tipadas
│   │   │   ├── logger.ts       # Instância Pino configurada
│   │   │   ├── mask.ts         # Mascaramento de CPF e CNPJ
│   │   │   └── response.ts     # sendSuccess / sendCreated helpers
│   │   ├── validators/
│   │   │   ├── auth.ts
│   │   │   ├── company.ts
│   │   │   ├── employee.ts
│   │   │   ├── payment.ts
│   │   │   └── index.ts
│   │   ├── index.ts            # Entry point do servidor
│   │   └── seed.ts             # Seed idempotente: 2 empresas, 5 colaboradores, 1 CPF user, 4 meses de transações
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── Dockerfile              # Imagem de produção do frontend (build + Nginx)
    ├── nginx.frontend.conf     # Configuração Nginx interna do container frontend
    ├── vitest.config.ts        # Configuração do Vitest
    ├── src/
    │   ├── __tests__/          # Testes unitários e de componentes
    │   │   ├── ProtectedRoute.test.tsx
    │   │   └── utils.test.ts
    │   ├── test/
    │   │   └── setup.ts        # Setup global do Vitest (@testing-library/jest-dom)
    │   ├── components/
    │   │   ├── ui/             # Componentes shadcn/ui (Button, Card, Dialog, ActivityCalendar, etc.)
    │   │   ├── AppLayout.tsx   # Layout base com sidebar e header mobile
    │   │   └── ProtectedRoute.tsx
    │   ├── contexts/
    │   │   └── AuthContext.tsx # Contexto global de autenticação
    │   ├── lib/
    │   │   ├── constants.ts    # PIX_STATUS_CONFIG e outras constantes
    │   │   └── utils.ts        # formatCurrency, formatCPF, parseBrazilianNumber, etc.
    │   ├── pages/
    │   │   ├── admin/
    │   │   │   ├── AdminOverview.tsx       # Dashboard + compra por cartão + exportação CSV
    │   │   │   ├── CompanyDetailPage.tsx   # Detalhes da empresa (colaboradores + calendário)
    │   │   │   ├── CpfUserDetailPage.tsx   # Detalhes do usuário CPF (info + calendário + cartão editável)
    │   │   │   └── SubscribersPage.tsx     # Lista de assinantes com link para detalhes
    │   │   ├── auth/
    │   │   │   ├── ChangePasswordPage.tsx
    │   │   │   ├── LoginPage.tsx
    │   │   │   └── RegisterPage.tsx
    │   │   ├── company/
    │   │   │   ├── CompanyOverview.tsx
    │   │   │   ├── EmployeeDetailPage.tsx
    │   │   │   └── EmployeesPage.tsx
    │   │   └── user/
    │   │       ├── PixPaymentPage.tsx
    │   │       └── UserDashboard.tsx
    │   ├── services/
    │   │   └── api.ts          # Axios client + todas as funções de API
    │   ├── types/
    │   │   └── index.ts        # Interfaces e enums TypeScript
    │   ├── App.tsx             # Roteamento principal e guards
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## Licença

[MIT](LICENSE)
