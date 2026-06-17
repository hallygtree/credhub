#!/bin/bash

# CredHub - Startup Script
# Este script inicializa todas as partes necessárias para a aplicação funcionar

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 não está instalado. Por favor, instale-o primeiro."
        exit 1
    fi
}

# Verificar dependências
print_header "Verificando dependências"

check_command node
check_command npm
check_command docker

print_success "Node.js: $(node --version)"
print_success "npm: $(npm --version)"
print_success "Docker: $(docker --version | cut -d' ' -f3)"

# Subir MongoDB com Docker
print_header "Iniciando MongoDB com Docker"

if docker ps --format '{{.Names}}' | grep -q 'credhub-mongo'; then
    print_warning "MongoDB já está rodando"
else
    if docker ps -a --format '{{.Names}}' | grep -q 'credhub-mongo'; then
        docker start credhub-mongo
        print_success "Container MongoDB iniciado"
    else
        docker compose up -d
        print_success "Container MongoDB criado e iniciado"
    fi
fi

# Aguardar MongoDB estar pronto
echo -n "Aguardando MongoDB estar pronto"
for i in {1..30}; do
    if docker exec credhub-mongo mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        echo ""
        print_success "MongoDB está pronto"
        break
    fi
    echo -n "."
    sleep 1
done

# Instalar dependências do Backend
print_header "Configurando Backend"

cd "$SCRIPT_DIR/backend"

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências do backend..."
    npm install
    print_success "Dependências do backend instaladas"
else
    print_warning "Dependências do backend já instaladas"
fi

# Executar seed (se necessário)
echo "Executando seed do banco de dados..."
npm run seed 2>/dev/null || print_warning "Seed já executado anteriormente"

# Instalar dependências do Frontend
print_header "Configurando Frontend"

cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências do frontend..."
    npm install
    print_success "Dependências do frontend instaladas"
else
    print_warning "Dependências do frontend já instaladas"
fi

# Iniciar aplicações
print_header "Iniciando Aplicações"

cd "$SCRIPT_DIR"

# Matar processos anteriores se existirem
pkill -f "tsx watch src/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Iniciar Backend em background
echo "Iniciando backend..."
cd "$SCRIPT_DIR/backend"
npm run dev > "$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"

# Aguardar backend iniciar
sleep 3

# Verificar se backend está rodando
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    print_success "Backend rodando em http://localhost:3001"
else
    print_warning "Backend iniciando... (verifique backend.log se houver problemas)"
fi

# Iniciar Frontend em background
echo "Iniciando frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev > "$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend.pid"

sleep 3
print_success "Frontend rodando em http://localhost:5173"

# Resumo final
print_header "Sistema Iniciado com Sucesso!"

echo -e "
${GREEN}Aplicação disponível em:${NC}
  Frontend: ${BLUE}http://localhost:5173${NC}
  Backend:  ${BLUE}http://localhost:3001/api${NC}

${GREEN}Credenciais de acesso (Demo):${NC}
  ${YELLOW}Super Admin${NC}         admin@credhub.com   / Admin@123456
  ${YELLOW}Gestor${NC}              empresa@demo.com       / Empresa@123456
  ${YELLOW}Colaborador${NC}         joao@demo.com          / Joao@123456
  ${YELLOW}Colaborador${NC}         maria@demo.com         / Maria@123456
  ${YELLOW}Usuario CPF${NC}         cpf.demo@teste.com     / CpfDemo@123456

${GREEN}Testes:${NC}
  Backend:  cd backend  && npm test
  Frontend: cd frontend && npm run test:run

${GREEN}Logs:${NC}
  Backend:  ${SCRIPT_DIR}/backend.log
  Frontend: ${SCRIPT_DIR}/frontend.log

${GREEN}Para parar a aplicação:${NC}
  ./stop.sh
"
