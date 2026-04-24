# Plataforma de Moradia — V3

Esta é a versão mais completa da plataforma local, ainda rodando com **Node.js puro + HTML/CSS/JavaScript**, sem dependências externas.

## Melhorias implementadas nesta versão

### 1) Múltiplos perfis
- criação de perfis financeiros
- troca rápida de perfil ativo
- exclusão de perfis (exceto o principal)
- imóveis vinculados ao perfil em que foram cadastrados

### 2) Dashboard mais forte
- métricas financeiras
- métricas analíticas do portfólio de imóveis do perfil ativo
- gráfico de composição do orçamento
- gráfico de custo dos imóveis do perfil ativo

### 3) Comparação lado a lado
- seleção de até 3 imóveis
- cards de comparação
- tabela comparativa detalhada

### 4) Segurança automática por bairro
- score automático de segurança
- explicação textual do score
- uso da segurança automática no ranking

### 5) Ranking e produtividade
- ranking com pesos configuráveis
- favoritos
- filtros avançados
- exportação CSV do perfil ativo

## Como executar
```powershell
node server.js
```
Depois abra:
```text
http://localhost:3000
```
Ou:
```powershell
npm start
```

## Estrutura do projeto
```text
plataforma-moradia-erick-v3/
├── server.js
├── package.json
├── README.md
├── data/
│   ├── profiles.json
│   ├── active_profile.json
│   ├── properties.json
│   ├── settings.json
│   └── security_index.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```
