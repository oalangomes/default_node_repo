# 🧼 Sanitize Docs Workflow

Este workflow é responsável por executar um processo de sanitização na documentação do repositório — normalmente removendo informações sensíveis, normalizando formatação ou limpando dados temporários antes de publicação.

---

## ⚙️ Arquivo YAML do Workflow

```yaml
name: Sanitize Markdown Docs

on:
  pull_request:
    paths:
      - 'docs/**/*.md'

jobs:
  sanitize:
    if: github.actor != 'github-actions[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Executar sanitização
        run: node scripts/sanitize-docs.js

      - name: Commitar mudanças (se existirem)
        run: |
          if [[ $(git status --porcelain) ]]; then
            git config user.name "github-actions"
            git config user.email "action@github.com"
            git add docs
            git commit -m "chore: sanitize docs filenames"
            # O segredo está aqui!
            git pull --rebase origin "${{ github.head_ref }}"
            git push origin HEAD:"${{ github.head_ref }}"
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```

---

## 💡 Funcionalidade esperada

Este workflow geralmente é usado para:

- Remover tokens, chaves, segredos ou identificadores do conteúdo da documentação antes de publicações.
- Garantir que a documentação siga um padrão de formatação (ex: lint de markdown, ortografia, etc).
- Automatizar limpeza de trechos de comentários de código, blocos de exemplo desnecessários ou metadados internos.
- Pode também ser integrado com processos como PR Review, Deploy de Docs, ou Pre-Release.

---

## ✅ Requisitos comuns

- Node.js ou Python instalado (caso scripts sejam executados no job)
- Dependências como `prettier`, `markdownlint`, `spellcheck`, etc
- Tokens de acesso (se for subir os docs sanitizados via PR ou commit)

---

## 🚀 Como rodar manualmente

Você pode disparar o workflow manualmente via aba **Actions > Run Workflow**, se a configuração permitir `workflow_dispatch`.

---

## 🛡️ Segurança

Certifique-se de que o script de sanitização:
- Não remova conteúdo crítico da documentação.
- Não vaze acidentalmente conteúdo sensível em logs.
- Seja versionado e auditável (sem código inline obscuro).

---

## 🧪 Sugestões de testes

- Teste o workflow em um branch separado (`docs-sanitization`)
- Compare `git diff` antes e depois da execução
- Use PRs automatizados para validar alterações

---

## 📌 Dica final

Esse tipo de automação é ideal para repositórios que publicam documentação automaticamente, garantindo que **o conteúdo final publicado seja seguro, limpo e padronizado**.

