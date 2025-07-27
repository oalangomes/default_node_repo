# 🚀 Automação de Release com Release Drafter

O **Release Drafter** é uma ferramenta que gera automaticamente rascunhos de versões (GitHub Releases) com base nos Pull Requests mergiados no repositório. É útil para manter changelogs organizados sem esforço manual.

---

## ✅ O que ele faz?

- Monitora merges de Pull Requests na branch principal (ex: `main`)
- Atualiza um *draft release* com base nas labels e títulos dos PRs
- Classifica automaticamente as mudanças (ex: Novidades, Correções, Manutenção)
- Permite revisão manual antes da publicação final do release

---

## ⚙️ Como configurar

### 1. Arquivo de Configuração

Crie o arquivo `.github/release-drafter.yml` com o seguinte conteúdo:

```yaml
name-template: "🚀 Versão: $NEXT_PATCH_VERSION"
tag-template: "v$NEXT_PATCH_VERSION"
categories:
  - title: "✨ Novidades"
    labels:
      - "feat"
  - title: "🐞 Correções"
    labels:
      - "fix"
  - title: "🛠️ Manutenção"
    labels:
      - "chore"
change-template: "- $TITLE (#$NUMBER)"
template: |
  ## Mudanças

  $CHANGES

  ---
  _Release gerado automaticamente com [Release Drafter](https://github.com/release-drafter/release-drafter)_
```

---

### 2. Workflow do GitHub Actions

Adicione um workflow `.github/workflows/release-drafter.yml`:

```yaml
name: Release Drafter

on:
  push:
    branches:
      - main
  pull_request:
    types: [closed]

permissions:
  contents: write

jobs:
  update_release_draft:
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v6
        with:
          config-name: release-drafter.yml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 🧠 Boas práticas

- Use labels nos Pull Requests (`feat`, `fix`, `chore`, etc.)
- Escreva títulos claros e objetivos nos PRs
- Publique manualmente o draft quando estiver pronto (ou use outro workflow para publicar automaticamente)

---

## 🛡️ Segurança

O `GITHUB_TOKEN` usado pelo workflow precisa de permissão `contents: write`, que já está definida no exemplo acima.

---

## 📦 Resultado

- Um draft release será atualizado automaticamente a cada merge na branch principal.
- O changelog será preenchido com os títulos dos PRs agrupados por categoria.
- Você poderá revisar e publicar com um clique em **"Releases" → "Edit draft" → "Publish release"**.

---

## 🧪 Testando

Você pode simular o comportamento:

1. Crie um PR com label `feat`
2. Faça o merge na `main`
3. Vá até a aba **Releases**
4. Veja o novo draft gerado

---

## ✅ Conclusão

O Release Drafter é uma ferramenta simples, leve e eficaz para manter seus changelogs atualizados e organizados automaticamente, sem abrir mão do controle manual da publicação.

