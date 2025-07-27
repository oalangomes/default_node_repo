# 🔄 Automação de Pull Request de `main` para `master`

Este workflow automatiza a criação de um **Pull Request de sincronização** entre as branches `main` e `master`, garantindo que alterações feitas em `main` sejam propagadas automaticamente para `master`.

---

## 🧩 Finalidade

Ideal para repositórios onde:

- `main` é a branch de desenvolvimento principal
- `master` representa a branch de produção/entrega
- Deseja-se manter `master` atualizada apenas via PRs automáticos (e não push direto)

---

## 🔧 Como tornar genérico

Para torná-lo aplicável a qualquer projeto:

1. **Use variáveis** para definir as branches de origem e destino:
   - `SOURCE_BRANCH`: normalmente `main`
   - `TARGET_BRANCH`: normalmente `master`

2. **Evite nomes hardcoded no título do PR**

3. **Use `GITHUB_TOKEN` para permissões automáticas**

---

## 📄 Exemplo de workflow genérico

```yaml
name: Auto PR - Sync Source to Target

on:
  push:
    branches:
      - ${ vars.SOURCE_BRANCH || 'main' }

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Criar Pull Request automático
        uses: repo-sync/pull-request@v2
        with:
          source_branch: ${ vars.SOURCE_BRANCH || 'main' }
          destination_branch: ${ vars.TARGET_BRANCH || 'master' }
          pr_title: "🔄 Sync `${ vars.SOURCE_BRANCH || 'main' }` to `${ vars.TARGET_BRANCH || 'master' }`"
          pr_body: "Este PR foi gerado automaticamente para manter as branches sincronizadas."
          pr_reviewer: ${ vars.DEFAULT_REVIEWER || '' }
        env:
          GITHUB_TOKEN: ${ secrets.GITHUB_TOKEN }
```

---

## ✅ O que você pode parametrizar

| Variável            | Descrição                          |
|---------------------|-------------------------------------|
| `SOURCE_BRANCH`     | Branch de origem (`main`, por padrão) |
| `TARGET_BRANCH`     | Branch de destino (`master`, por padrão) |
| `DEFAULT_REVIEWER`  | Usuário ou time para revisar o PR  |

---

## 📌 Quando usar

- Após merges em `main`, deseja-se manter `master` alinhada
- Equipes com separação clara entre desenvolvimento e release
- Automatizar fluxo Git sem depender de merge manual repetitivo

---

## 🚨 Cuidados

- Evite conflitos frequentes entre as branches
- Garanta que `main` esteja sempre validada (testes, lint) antes do merge automático
- Configure revisores se desejar aprovação manual

---

## ✅ Conclusão

Este workflow elimina a necessidade de criar PRs manuais entre branches principais, garantindo sincronização automática entre `main` e `master` — ou qualquer outra combinação que você definir.

