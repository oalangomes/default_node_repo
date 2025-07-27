import { execFileSync } from 'child_process';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateEnvVars } from './utils/env.js';
import { sanitizeDiff } from './utils/sanitize.js';

// Função auxiliar com retries para chamadas assíncronas
async function callWithRetry(fn, desc, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const more = attempt < retries;
      console.error(`${desc} falhou (tentativa ${attempt}):`, err.message);
      if (!more) throw err;
      await new Promise(res => setTimeout(res, attempt * 1000));
    }
  }
}

// Normaliza texto para facilitar comparação (case-insensitive, remove espaços)
function normalize(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Chamada ao OpenRouter
async function callOpenRouter(messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'tngtech/deepseek-r1t2-chimera:free', messages })
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta inválida da OpenRouter');
  return content;
}

// Fallback com Together
async function callTogether(messages) {
  const models = [
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
    'deepseek-ai/DeepSeek-R1-0528',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free'
  ];
  for (const model of models) {
    try {
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages })
      });
      if (!response.ok) {
        console.error(`Modelo ${model} falhou: ${response.status}`);
        continue;
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (err) {
      console.error(`Erro no modelo ${model}:`, err.message);
    }
  }
  throw new Error('Todos os modelos de fallback falharam');
}

(async () => {
  try {
    validateEnvVars(['OPENROUTER_API_KEY', 'GITHUB_TOKEN']);
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const prNumber = process.env.PR_NUMBER;

    // Busca dados do PR
    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    const title = pr.title || '';
    const body = pr.body || '';

    // Lê o template do PR (se existir)
  let prTemplate = '';
  const templatePath = resolve('.github', 'pull_request_template.md');
  if (existsSync(templatePath)) {
    prTemplate = readFileSync(templatePath, { encoding: 'utf8' });
    if (/<[^>]+>/.test(prTemplate)) {
      throw new Error('Template inválido: contém tags não processadas');
    }
  }

    // 1. Checagem: Body vazio ou igual ao template? Sugerir modelo e parar!
    if (
      !normalize(body) ||
      (normalize(prTemplate) && normalize(body) === normalize(prTemplate))
    ) {
      const novoBody = `
### Preencha seu Pull Request corretamente!

- **Objetivo:** _Explique o objetivo deste PR_
- **Principais Mudanças:** _Liste as alterações realizadas_
- **Contexto/Observações:** _Informe qualquer ponto importante ou contexto adicional_

_Edite e salve seu PR para liberar o resumo automático por IA!_
      `.trim();

      // Atualiza o body do PR
      await octokit.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body: novoBody
      });

      // Comenta informando a ação
      await callWithRetry(
        () =>
          octokit.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: `⚠️ O corpo do PR estava vazio ou só com o template padrão.
Foi sugerido um modelo de preenchimento acima.
_Complete e salve o PR para liberar explicação automática por IA!_`
          }),
        'Comentar no PR'
      );
      console.log("PR sem informações relevantes. Body atualizado com sugestão e comentário enviado. Nenhuma explicação IA gerada.");
      return;
    }

    // 2. Pega o diff do PR
    const mainBranch = process.env.DEFAULT_BRANCH || 'main';
    // Valida nome da branch principal: apenas letras, numeros e hifen
    // Prevencao simples contra path traversal em operacoes git
    if (!/^[\w-]+$/.test(mainBranch)) {
      throw new Error('Nome do branch principal inválido');
    }
    const diff = execFileSync('git', ['diff', `origin/${mainBranch}...HEAD`], {
      encoding: 'utf8'
    });

    let MAX_DIFF_SIZE = parseInt(process.env.MAX_DIFF_SIZE || '5000', 10);
    if (!Number.isFinite(MAX_DIFF_SIZE) || MAX_DIFF_SIZE <= 0) {
      MAX_DIFF_SIZE = 5000;
    }
    const trimmed = diff.length > MAX_DIFF_SIZE;
    const trimmedDiff = trimmed
      ? diff.slice(0, MAX_DIFF_SIZE) + '... [TRUNCADO]'
      : diff;
    if (trimmed) {
      console.log(`⚠️ Diff truncado (limite ${MAX_DIFF_SIZE} caracteres)`);
    }
    const sanitizedDiff = sanitizeDiff(trimmedDiff);

    // 3. Monta o prompt para IA
    const prompt = `
Você é um engenheiro de software experiente.
Explique de forma clara e didática o que muda neste Pull Request.
Considere:
- O título e descrição
- O diff das alterações
- O template de Pull Request que usamos no projeto

Siga o modelo do template do PR para organizar sua resposta.

Título: ${title}
Descrição: ${body}

--- TEMPLATE DO PR ---
${prTemplate}
--- FIM DO TEMPLATE ---

Diff:
${sanitizedDiff}
`;

    // 4. Monta mensagens e usa OpenRouter com fallback para Together
    const messages = [
      { role: 'system', content: 'Você é um engenheiro de software experiente.' },
      { role: 'user', content: prompt }
    ];

    let summary;
    try {
      summary = await callOpenRouter(messages);
    } catch (err) {
      console.error('OpenRouter falhou:', err.message);
      if (!process.env.TOGETHER_API_KEY) throw err;
      validateEnvVars(['TOGETHER_API_KEY']);
      summary = await callTogether(messages);
    }

    // 5. Comenta o resumo no PR
    await callWithRetry(
      () =>
        octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `📝 **Explicação automática deste PR (baseada no template):**\n\n${summary}`,
        }),
      'Comentar resumo'
    );

    // (Opcional) — Adiciona o resumo da IA no body do PR (descomente se quiser)
    /*
    const novoBody = `${body}

---

📝 **Resumo automático IA:**

${summary}
`;
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: novoBody
    });
    */

    console.log("Resumo postado com sucesso!");
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Erro durante execução:', err.message);
    } else {
      console.error('Erro durante execução:', err.stack || err);
    }
    process.exit(1);
  }
})();
