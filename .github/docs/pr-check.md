# ✅ PR Check - Testes, Lint e Cobertura

Este workflow executa **validações automatizadas em Pull Requests** antes da aprovação, garantindo que:
- O código está formatado (Lint)
- Os testes passam corretamente
- A cobertura de testes é coletada e enviada para o Codecov

---

## 🚦 Quando é executado?

Este workflow roda automaticamente em:

- Pull Requests abertos para a branch configurada (`main`, por padrão)
- PRs reabertos, atualizados ou sincronizados

---

## ⚙️ Como configurar no seu repositório

### 1. Crie o arquivo do workflow

Salve como `.github/workflows/pr-check.yml`:

```yaml
name: PR Check - Testes e Lint

on:
  pull_request:
    branches: [${{ vars.TARGET_BRANCH || 'main' }}]

permissions:
  contents: read
  actions: read
  id-token: write

jobs:
  check:
    name: Testes e Lint
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      mongo:
        image: mongo:4.4
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongo --eval 'db.runCommand({ ping: 1 })'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      MONGO_URI: ${{ vars.MONGO_URI || 'mongodb://localhost:27017/project-test' }}

    steps:
      - name: Checkout do código
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Instalar dependências
        run: npm ci

      - name: Rodar Linter
        run: npm run lint

      - name: Rodar Testes com Cobertura
        run: npm run test:coverage

      - name: Upload relatório de cobertura como artefato
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - name: Upload cobertura para Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests
          name: ${{ vars.PROJECT_NAME || 'backend-node' }}
          fail_ci_if_error: true
```

---

## 🔐 Secrets necessários

| Nome                | Descrição                        |
|---------------------|----------------------------------|
| `CODECOV_TOKEN`     | Token do seu projeto no Codecov |

> Gere um token em: https://app.codecov.io/

---

## 🧩 Variáveis recomendadas

Você pode configurar variáveis reutilizáveis no repositório ou organização:

| Variável         | Exemplo                            | Descrição                                |
|------------------|------------------------------------|--------------------------------------------|
| `TARGET_BRANCH`  | `main`                             | Branch para onde os PRs serão abertos     |
| `PROJECT_NAME`   | `my-cool-api`                      | Nome a ser exibido no Codecov             |
| `MONGO_URI`      | `mongodb://localhost:27017/teste` | URI de conexão local para testes          |

Configure em:  
`Settings → Actions → Variables → New repository variable`

---

## 📦 Artefato gerado

- O relatório de cobertura HTML (pasta `coverage/`) é salvo como artefato no GitHub.
- Também é enviado para o Codecov, onde pode ser visualizado graficamente.

---

## 🎯 O que você precisa no projeto para funcionar

1. Um script `npm run lint` configurado (Ex: ESLint)
2. Um script `npm run test:coverage` que gere o arquivo `coverage/lcov.info` (Ex: Jest)
3. Arquivo `package-lock.json` para uso do cache

---

## ✅ Resultado final

- **PRs com problemas de lint ou testes quebrados** falham na checagem
- **Cobertura é enviada para o Codecov**
- **Equipe tem mais confiança no código antes de aprovar o merge**

---

## 📚 Exemplo de README badge

```md
[![Coverage Status](https://codecov.io/gh/SeuUser/SeuRepo/branch/main/graph/badge.svg)](https://codecov.io/gh/SeuUser/SeuRepo)
```

---

## 🧠 Dica

Você pode combinar este workflow com:
- `Auto Explain PR`: explicações automáticas dos PRs
- `AI Code Review`: revisão por IA com aprovação automática
- `Daily Deploy`: deploy automático diário com verificação de alterações
