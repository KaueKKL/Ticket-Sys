Ticket-Sys – Sistema de Gestão de Tickets Corporativo

Uma plataforma robusta para gestão de atendimentos técnicos, cálculo de SLA e integração transparente com sistemas legados (ERP).

🎯 Visão Geral

O Ticket-Sys resolve o problema de gerir equipas de suporte técnico que precisam de mobilidade e precisão no apontamento de horas, sem perder a conexão com a base de dados de clientes antiga da empresa.

Principais Funcionalidades

✅ Gestão de SLA Inteligente: O sistema calcula automaticamente o tempo líquido trabalhado, descontando pausas como "Aguardando Cliente".

✅ Busca Híbrida (Legacy Integration): Pesquisa clientes em tempo real numa base MongoDB 3.4 antiga, utilizando drivers nativos isolados, sem necessidade de migração de dados.

✅ Interface Mobile-First: Dashboard e Listas adaptam-se automaticamente para cartões em dispositivos móveis.

✅ Timeline de Atendimento: Registo de notas internas e histórico de alterações de estado.

✅ Dashboard Analítico: Indicadores de performance (KPIs) e gráficos de produtividade por técnico.

🛠️ Stack Tecnológico

O projeto segue uma arquitetura Monorepo (Frontend e Backend no mesmo repositório).

Backend (API REST)

Runtime: Node.js + Express

Database (Core): MongoDB v6+ (via Mongoose)

Database (Legacy): MongoDB v3.4 (via Driver Nativo v3.7)

Auth: JWT (JSON Web Tokens)

Testes: Jest + Supertest + MongoDB Memory Server

Frontend (SPA)

Framework: React + Vite

UI Library: Material UI v6 (MUI)

Http Client: Axios (com Interceptors)

Charts: Recharts

📸 Screenshots

(Espaço reservado para adicionar imagens do Dashboard, Tela de Login e Mobile)

Dashboard (Desktop)

Visualização Mobile





🚀 Como Executar (Docker)

A forma mais recomendada de subir o ambiente é utilizando Docker Compose.

Pré-requisitos

Docker & Docker Compose

Acesso de rede ao servidor MongoDB Legado (v3.4)

Passo a Passo

Clone o repositório:

git clone [https://github.com/seu-usuario/ticket-sys.git](https://github.com/seu-usuario/ticket-sys.git)
cd ticket-sys


Configure as Variáveis de Ambiente:
Crie um arquivo .env na pasta backend/ (ou configure no docker-compose):

MONGO_URI=mongodb://mongo_new:27017/ticket_system
# Use host.docker.internal para acessar o banco legado na máquina host
MONGO_LEGACY_URI=mongodb://host.docker.internal:12220/DigisatServer
JWT_SECRET=sua_chave_secreta_segura


Suba os contentores:

docker-compose up -d --build


Aceda à aplicação:

Frontend: http://localhost:5173

API: http://localhost:3033

🧪 Testes Automatizados

O sistema possui uma suíte de testes de integração cobrindo fluxos críticos (Auth, Tickets, Cálculo de Tempo).

Para rodar os testes localmente:

cd backend
npm install
npm test


Nota: Os testes utilizam um banco em memória, não afetando os dados reais.

📂 Estrutura do Projeto

ticket-sys/
├── backend/              # API Server
│   ├── config/           # Conexão Híbrida (Legacy/New)
│   ├── controllers/      # Lógica de Negócio
│   ├── models/           # Schemas Mongoose
│   ├── routes/           # Rotas Express
│   └── tests/            # Testes Automatizados (Jest)
├── frontend/             # React App
│   ├── src/
│   │   ├── components/   # Componentes Reutilizáveis
│   │   ├── context/      # AuthContext
│   │   ├── layouts/      # Layout Mestre Responsivo
│   │   ├── pages/        # Telas (Dashboard, Tickets, Settings)
│   │   └── services/     # Configuração Axios
└── docker-compose.yml    # Orquestração


📅 Roadmap v2.0

[ ] Websockets: Atualização do Dashboard em tempo real.

[ ] Integração Financeira: Geração automática de cobrança no ERP Digisat.

[ ] Relatórios PDF: Exportação de fecho mensal por cliente.

📝 Licença

Este projeto é proprietário e desenvolvido para uso interno corporativo.