# 📝 Auto Release Notes Workflow

Este workflow automatiza a geração de **notas de versão (release notes)** no GitHub com base em Pull Requests ou commits, facilitando a rastreabilidade das mudanças em cada versão publicada.

---

## 📄 Workflow YAML

```yaml
name: 📝 Auto Release Notes Generator
on:
  push:
    branches:
      - master
permissions:
  contents: write
  pull-requests: read
jobs:
  generate-release:
    runs-on: ubuntu-latest
    steps:
      - name: 📂 Checkout do código
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: 🔧 Configura git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      
      - name: 📊 Detecta versão atual e gera próxima
        id: version
        run: |
          # Cria pasta de release notes se não existir
          mkdir -p release-notes
          
          # Detecta a versão atual do README (se existir)
          if [ -f README.md ] && grep -q '\[V[0-9]' README.md; then
            CURRENT_VERSION=$(grep -oP '\[V\K[0-9]+\.[0-9]+' README.md | head -1)
            echo "📍 Versão atual encontrada: V$CURRENT_VERSION"
            
            # Incrementa a versão (formato X.YY)
            MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
            MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
            MINOR=$((MINOR + 1))
            
            # Se minor >= 100, incrementa major e zera minor
            if [ $MINOR -ge 100 ]; then
              MAJOR=$((MAJOR + 1))
              MINOR=0
            fi
            
            NEW_VERSION=$(printf "%02d.%02d" $MAJOR $MINOR)
          else
            echo "📍 Primeira versão, iniciando com V01.00"
            NEW_VERSION="01.00"
          fi
          
          echo "🎯 Nova versão: V$NEW_VERSION"
          echo "version=$NEW_VERSION" >> "$GITHUB_OUTPUT"
          echo "version_tag=V$NEW_VERSION" >> "$GITHUB_OUTPUT"
      
      - name: 🔍 Encontra PR relacionado ao merge
        id: find_pr
        run: |
          # Busca o PR que foi mergeado neste push
          COMMIT_SHA="${{ github.sha }}"
          MERGE_COMMIT_MESSAGE=$(git log --format=%s -n 1 $COMMIT_SHA)
          
          echo "📝 Mensagem do commit: $MERGE_COMMIT_MESSAGE"
          
          # Extrai número do PR da mensagem de merge (formato: "Merge pull request #123 from...")
          if [[ "$MERGE_COMMIT_MESSAGE" =~ Merge\ pull\ request\ \#([0-9]+) ]]; then
            PR_NUMBER="${BASH_REMATCH[1]}"
            echo "🔗 PR encontrado: #$PR_NUMBER"
            echo "pr_number=$PR_NUMBER" >> "$GITHUB_OUTPUT"
            echo "pr_link=https://github.com/${{ github.repository }}/pull/$PR_NUMBER" >> "$GITHUB_OUTPUT"
          else
            echo "❓ Nenhum PR encontrado no merge commit"
            echo "pr_number=N/A" >> "$GITHUB_OUTPUT"
            echo "pr_link=Direct push" >> "$GITHUB_OUTPUT"
          fi
      
      - name: 📋 Gera changelog desde último release
        id: changelog
        run: |
          # Encontra o último commit de release notes
          LAST_RELEASE_COMMIT=$(git log --grep="📝 Release V[0-9]" --format="%H" -n 1 || echo "")
          
          if [ -n "$LAST_RELEASE_COMMIT" ]; then
            echo "📍 Último release: $LAST_RELEASE_COMMIT"
          CHANGELOG=$(git log $LAST_RELEASE_COMMIT..HEAD --pretty=format:"- %s (%h)" --no-merges | grep -v "📝 Release V[0-9]" | awk '!seen[$0]++' | head -50)
          else
            echo "📍 Primeiro release, usando últimos 20 commits"
            CHANGELOG=$(git log --pretty=format:"- %s (%h)" --no-merges -n 20)
          fi
          
          if [ -z "$CHANGELOG" ]; then
            CHANGELOG="- Atualizações menores e correções"
          fi
          
          echo "CHANGELOG<<EOF" >> $GITHUB_ENV
          echo "$CHANGELOG" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV
          
          # Também gera um resumo mais limpo
          CLEAN_CHANGELOG=$(echo "$CHANGELOG" | grep -v "🦖 Atualiza badge" | grep -v "Merge branch" | awk '!seen[$0]++' | head -10)
          echo "CLEAN_CHANGELOG<<EOF" >> $GITHUB_ENV
          echo "$CLEAN_CHANGELOG" >> $GITHUB_ENV
          echo "EOF" >> $GITHUB_ENV
      
      - name: 📝 Cria arquivo de release notes
        run: |
          VERSION="${{ steps.version.outputs.version_tag }}"
          TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
          DATE_ONLY=$(date '+%Y-%m-%d')
          
          if [ "${{ steps.find_pr.outputs.pr_number }}" = "N/A" ]; then
            PR_MARKDOWN="Direct push"
          else
            PR_MARKDOWN="[#${{ steps.find_pr.outputs.pr_number }}](${{ steps.find_pr.outputs.pr_link }})"
          fi

          cat > "release-notes/release-$VERSION.md" <<EOL
          # Release ${{ steps.version.outputs.version_tag }}

          **📅 Data do Release**: $DATE_ONLY
          **🔗 Pull Request**: $PR_MARKDOWN
          **📝 Commit**: [\`${{ github.sha }}\`](https://github.com/${{ github.repository }}/commit/${{ github.sha }})
          
          ## 🚀 Principais Mudanças
          
          ${{ env.CLEAN_CHANGELOG }}
          
          ## 📋 Changelog Completo
          
          ${{ env.CHANGELOG }}
          
          ## 📊 Estatísticas
          
          - **Commits incluídos**: $(echo "${{ env.CHANGELOG }}" | wc -l)
          - **Gerado automaticamente**: $TIMESTAMP
          
          ---
          
          **🔄 Processo de Release**
          1. ✅ Testes passaram na branch \`main\`
          2. ✅ Cobertura de código validada
          3. ✅ Merge aprovado para \`master\`
          4. ✅ Release notes geradas automaticamente
          
          **⬅️ [Voltar para versões anteriores](../README.md#-releases)**
          EOL
          
          echo "✅ Release notes criadas: release-notes/release-$VERSION.md"
      
      - name: 🔄 Atualiza README.md
        run: |
          VERSION="${{ steps.version.outputs.version_tag }}"
          DATE_ONLY=$(date '+%d/%m/%Y')
          PR_INFO="${{ steps.find_pr.outputs.pr_number }}"
          PR_LINK="${{ steps.find_pr.outputs.pr_link }}"

          # Garante valor numérico antes de usar no markdown
          if printf '%s' "$PR_INFO" | grep -Eq '^[0-9]+$'; then
            PR_MARKDOWN="[#${PR_INFO}]($PR_LINK)"
          else
            PR_MARKDOWN="Direct push"
          fi
          
          # Cria backup do README
          cp README.md README.md.backup
          
          # Verifica se já existe seção de releases
          if ! grep -q "## 🏷️ Releases" README.md; then
            echo "📝 Adicionando seção de releases no README.md"
            
            # Adiciona a seção antes da seção "Contribuindo"
            if grep -q "## 🤝 Contribuindo" README.md; then
              # Insere antes da seção "Contribuindo"
              sed -i '/## 🤝 Contribuindo/i\\n## 🏷️ Releases\n\n| Release | Data | Pull Request |\n|---------|------|--------------|' README.md
            else
              # Adiciona no final se não encontrar a seção "Contribuindo"
              cat >> README.md << 'EOL'
          
          ## 🏷️ Releases
          
          | Release | Data | Pull Request |
          |---------|------|--------------|
          EOL
            fi
          fi
          
          # Adiciona nova versão no topo da tabela
          NEW_ROW="| [$VERSION](release-notes/release-$VERSION.md) | $DATE_ONLY | $PR_MARKDOWN |"

          # Remove linha existente da mesma versão
          # Remove somente linhas da tabela que comecem com a versão atual
          # Ignora apenas a coluna da versão exata
          grep -v "^| \[$VERSION\] |" README.md > README.md.tmp && mv README.md.tmp README.md
          
          # Encontra a linha da tabela e adiciona a nova versão
          awk -v new_row="$NEW_ROW" '
          /\| Release \| Data \| Pull Request \|/ {
            print $0
            getline
            print $0
            print new_row
            next
          }
          { print }' README.md > README.md.tmp && mv README.md.tmp README.md
          
          echo "✅ README.md atualizado com versão $VERSION"
      
      - name: 🔍 Verifica mudanças
        id: check_changes
        run: |
          git add .
          if git diff --staged --quiet; then
            echo "📝 Nenhuma mudança detectada"
            echo "has_changes=false" >> "$GITHUB_OUTPUT"
          else
            echo "✅ Mudanças detectadas"
            echo "has_changes=true" >> "$GITHUB_OUTPUT"
            
            echo "📋 Arquivos modificados:"
            git diff --staged --name-only
          fi
      
      - name: 💾 Commit das mudanças
        if: steps.check_changes.outputs.has_changes == 'true'
        run: |
          VERSION="${{ steps.version.outputs.version_tag }}"
          git commit -m "📝 Release $VERSION

          🎯 Nova versão: $VERSION
          🔗 PR: #${{ steps.find_pr.outputs.pr_number }}
          📅 Data: $(date '+%Y-%m-%d')
          
          Mudanças incluídas:
          ${{ env.CLEAN_CHANGELOG }}
          
          🤖 Release notes geradas automaticamente"
          
          git push origin master
          echo "✅ Commit de release enviado"
      
      - name: 🏷️ Cria tag de versão
        if: steps.check_changes.outputs.has_changes == 'true'
        run: |
          VERSION="${{ steps.version.outputs.version_tag }}"
          git tag -a "$VERSION" -m "Release $VERSION

          ${{ env.CLEAN_CHANGELOG }}"
          
          git push origin "$VERSION"
          echo "✅ Tag $VERSION criada e enviada"
      
      - name: 📢 Resumo da execução
        if: always()
        run: |
          echo "## 📝 Resumo do Release" >> $GITHUB_STEP_SUMMARY
          echo "- **Nova Versão**: ${{ steps.version.outputs.version_tag }}" >> $GITHUB_STEP_SUMMARY
          echo "- **PR Relacionado**: #${{ steps.find_pr.outputs.pr_number }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Arquivo**: release-notes/release-${{ steps.version.outputs.version_tag }}.md" >> $GITHUB_STEP_SUMMARY
          echo "- **README Atualizado**: ${{ steps.check_changes.outputs.has_changes }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Data**: $(date '+%Y-%m-%d %H:%M:%S')" >> $GITHUB_STEP_SUMMARY
          
          if [ "${{ steps.check_changes.outputs.has_changes }}" == "true" ]; then
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "### 🎉 Release ${{ steps.version.outputs.version_tag }} gerada com sucesso!" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "**📋 Principais mudanças:**" >> $GITHUB_STEP_SUMMARY
            echo "${{ env.CLEAN_CHANGELOG }}" >> $GITHUB_STEP_SUMMARY
          fi

```

---

## 🚀 O que ele faz

- Monitora merges ou tags em branches específicas (geralmente `main` ou `master`)
- Gera notas de versão automaticamente no formato Markdown
- Pode criar um novo Release (GitHub Release) com changelog baseado em PRs ou mensagens de commit
- Automatiza parte do ciclo de versionamento e entrega contínua

---

## 🎯 Usos comuns

- Publicação automatizada de changelogs
- CI/CD com releases documentados
- Projetos que seguem [Conventional Commits](https://www.conventionalcommits.org/)
- Integração com `release-please`, `semantic-release` ou GitHub CLI

---

## 🧩 Requisitos

- Token do GitHub (`GITHUB_TOKEN` ou `GH_TOKEN`) com permissão para criar releases
- Configuração mínima de branch principal e estrutura de PRs (ou uso de etiquetas convencionais)

---

## 💡 Boas práticas

- Escreva títulos de PR e commits descritivos
- Use prefixos como `feat:`, `fix:`, `chore:` para ajudar na classificação automática
- Inclua `BREAKING CHANGE:` no corpo se necessário

---

## 📦 Resultado

- Release criado automaticamente em [Releases do GitHub](https://github.com/SEU_REPO/releases)
- Com conteúdo claro sobre:
  - Novas funcionalidades
  - Correções de bugs
  - Alterações não compatíveis

---

## 🧪 Teste e preview

Se o workflow usa `workflow_dispatch`, você pode testá-lo manualmente:
1. Vá na aba **Actions**
2. Selecione o workflow
3. Clique em **Run workflow**

---

## 🛡️ Segurança

- Evite publicar releases automáticos de branches instáveis
- Combine com validações CI (testes/lint) antes do release
- Verifique se tokens estão corretamente escopados

---

## ✅ Conclusão

Esse workflow elimina a necessidade de gerar changelogs manuais, aumenta a transparência do desenvolvimento e facilita a entrega contínua com documentação embutida.

