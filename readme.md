🎟️ Ticket-Sys (Enterprise Edition)
Gestão Inteligente de Atendimentos Técnicos com Integração ERP Legada

O Ticket-Sys é uma plataforma full-stack projetada para resolver o desafio de modernizar o suporte técnico sem abandonar o sistema de gestão (ERP) legado da empresa. Ele atua como uma camada ágil de operação, permitindo controle de SLA, apontamento de horas preciso e, crucialmente, a geração automática de faturamento no banco de dados legado.

🌟 Principais Funcionalidades
1. ⏱️ Gestão de Tempo & SLA (Novo)
Cronômetro Inteligente: O sistema calcula o tempo líquido trabalhado com precisão cirúrgica.

Play/Pause Real: Botões de ação que registram o motivo da pausa (ex: "Almoço", "Peça Pendente").

Desconto Automático: O status "Aguardando Cliente" pausa automaticamente o relógio, garantindo uma cobrança justa.

2. 💸 Faturamento Automatizado (Billing)
Geração de OS: Transforma tickets finalizados em Ordens de Serviço (DAV-OS) diretamente no ERP Digisat.

Regra de Cobrança: Aplica regras de negócio configuráveis (ex: arredondamento para hora cheia Math.ceil).

Snapshots Fiscais: Cria cópias estáticas de Clientes e Serviços no momento da venda, garantindo integridade fiscal no ERP mesmo se o cadastro mudar depois.

3. 🧬 Integração Híbrida (Legacy Integration)
Dual Database: O Backend conecta simultaneamente ao MongoDB moderno (dados da aplicação) e ao MongoDB 3.4 (ERP Legado).

Leitura em Tempo Real: Busca clientes e produtos diretamente da base legada.

Escrita Segura: Injeta documentos complexos (Movimentacao, Parcela) seguindo estritamente o schema C#/.NET do sistema original.

4. 🧪 Laboratório de Testes (Sandbox)
Ambiente Seguro: Uma área dedicada nas configurações para testar a integração com o ERP.

Rollback Automático: Permite gerar uma OS de teste real e removê-la com um clique, garantindo que a base de produção não fique suja.

5. 📱 Interface Moderna
Numeração Amigável: Tickets gerados com ID sequencial diário (ex: 202512020001) para fácil comunicação.

Mobile-First: Cards responsivos para técnicos em campo.

Dashboard: KPIs de produtividade e gráficos de atendimento.

🛠️ Arquitetura Técnica
O projeto utiliza uma arquitetura Monorepo (Backend e Frontend no mesmo repositório).

Backend (Node.js + Express)
Drivers:

mongoose: Para dados core (Tickets, Users).

mongodb-legacy: Driver nativo v3.7 para compatibilidade com MongoDB 3.4 (sem suporte a Promises modernas).

Services: Camada de abstração (digisatService.js) que isola a complexidade da montagem de objetos fiscais.

Testes: Jest + Supertest com Mock manual de Date para testes de cronômetro sem flakiness.

Frontend (React + Vite)
UI: Material UI v6 (Grid v2).

State: Context API para Autenticação.

Features: Listagem com filtros dinâmicos, Modais de ação rápida e Toast notifications.

🚀 Guia de Instalação
Pré-requisitos
Node.js v18+

MongoDB Local (para o Ticket-Sys)

Acesso de rede ao Servidor MongoDB Legado (ERP)

1. Backend
Bash

cd backend
npm install

# Crie o arquivo .env com as configurações:
# PORT=5000
# MONGO_URI=mongodb://localhost:27017/ticketsys
# MONGO_LEGACY_URI=mongodb://SERVIDOR_ERP:27017/Digisat
# JWT_SECRET=sua_senha_secreta

npm run dev
2. Frontend
Bash

cd frontend
npm install
npm run dev
⚙️ Configuração Inicial (Obrigatório)
Antes de gerar o primeiro faturamento, é necessário configurar os parâmetros de integração:

Acesse o sistema e vá em Configurações > Integração ERP.

Defina a Empresa Matriz (Quem emite a nota).

Selecione o Serviço Padrão (Ex: Hora Técnica).

Selecione a Operação Fiscal (CFOP de Saída de Serviço).

Configure o Horário de Expediente (para relatórios futuros).

Salve. O indicador ficará Verde.

🧪 Executando Testes
O sistema possui uma suíte de testes robusta que valida desde o login até o cálculo matemático do tempo líquido.

Bash

cd backend
npm test -- --runInBand
A flag --runInBand é necessária para evitar conflitos de porta no banco em memória.

📂 Estrutura de Pastas
ticket-sys/
├── backend/
│   ├── config/           # Conexão com Legado (legacyDb.js)
│   ├── controllers/      # Lógica (Billing, Ticket, Integration)
│   ├── models/           # Schemas (incluindo TicketSequence)
│   ├── services/         # Regras de Negócio Complexas (DigisatService)
│   ├── utils/            # Helpers de conversão (C# Version, Snapshots)
│   └── tests/            # Testes de Integração
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Billing/  # Tela de Faturamento
│   │   │   ├── Tickets/  # Listagem e Kanban
│   │   │   └── Settings/ # Configuração e Laboratório
│   │   └── services/     # API Client
└── ...
📅 Roadmap & Futuro
[x] Fase 1: CRUD Tickets, Auth e Dashboard.

[x] Fase 2: Integração Financeira (Geração de OS) e Cronômetro.

[ ] Fase 3: Portal do Cliente para abertura de chamados.

Desenvolvido por Kauê Keiser Lindner Versão: 1.0.0-pre-release