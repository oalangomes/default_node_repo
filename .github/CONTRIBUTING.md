# Guia de Contribuição

Obrigado por seu interesse em contribuir! Este guia descreve as etapas para colaborar de forma eficaz.

## Antes de Começar

1. **Leia o [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)** e certifique‑se de que você concorda e seguirá as regras de convivência.
2. **Abra um issue.** Para relatórios de bugs ou sugestões de funcionalidades, crie um _issue_ e forneça o máximo de contexto possível. Evite abrir pull requests não solicitadas para grandes mudanças sem discutir primeiro.
3. **Configure o ambiente de desenvolvimento:**

   ```bash
   git clone https://github.com/oalangomes/NeuroTrack_MS.git
   cd NeuroTrack_MS
   npm install
   npm run test
   ```

4. **Siga a convenção de mensagens de commit.** Utilize o padrão [Conventional Commits](https://www.conventionalcommits.org/) (ex.: `feat(login): adiciona autenticação com JWT`). Mensagens claras facilitam o histórico e automações de release.

## Fluxo de Trabalho

1. **Crie uma branch a partir de `main`:**

   ```bash
   git checkout -b feat/descricao-da-feature
   # ou
   git checkout -b fix/descricao-do-bug
   ```

2. **Faça suas alterações.** Certifique‑se de adicionar testes para qualquer nova funcionalidade ou correção de bug. Execute `npm run lint` e `npm test` localmente antes de enviar.

3. **Atualize a documentação.** Se você modificar ou adicionar comportamentos públicos, atualize os arquivos em `docs/` e o `README.md` quando aplicável.

4. **Abra um Pull Request.** Descreva claramente a motivação da mudança, o que foi feito e como testar. Se houver um issue relacionado, referencie‑o usando `Fixes #<número do issue>`.

5. **Responder ao feedback.** Os maintainers podem solicitar alterações. Isso faz parte do processo de revisão; mantenha um diálogo saudável e responda às solicitações de forma oportuna.

## Testes

- Execute `npm run test` para rodar a suíte de testes.
- Os pull requests que reduzirem a cobertura de testes abaixo do limite estabelecido podem ser bloqueados pelo CI. Tente manter ou aumentar a cobertura.

## Assinatura do DCO (opcional)

Para garantir a conformidade legal das contribuições, este projeto pode exigir a assinatura do Developer Certificate of Origin (DCO). Caso apareça uma verificação falha do DCO no seu PR, siga as instruções na mensagem de erro para assinar seus commits.

Agradecemos por dedicar seu tempo para melhorar o projeto!
