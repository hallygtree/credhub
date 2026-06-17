#!/bin/bash

# CredHub - Stop Script
# Este script para todas as partes da aplicação

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Parando CredHub...${NC}\n"

# Parar Backend
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Backend parado${NC}"
    fi
    rm -f .backend.pid
fi

# Parar Frontend
if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✓ Frontend parado${NC}"
    fi
    rm -f .frontend.pid
fi

# Matar processos restantes
pkill -f "tsx watch src/index.ts" 2>/dev/null && echo -e "${GREEN}✓ Processo tsx parado${NC}" || true
pkill -f "vite.*credhub" 2>/dev/null && echo -e "${GREEN}✓ Processo vite parado${NC}" || true

# Perguntar se deve parar o MongoDB
echo ""
read -p "Deseja parar o MongoDB também? (s/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    docker stop credhub-mongo 2>/dev/null && echo -e "${GREEN}✓ MongoDB parado${NC}" || echo -e "${YELLOW}MongoDB já estava parado${NC}"
fi

echo -e "\n${GREEN}Sistema parado com sucesso!${NC}"
