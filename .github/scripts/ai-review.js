// .github/scripts/ai-review.js (ESM)
import { execFileSync } from 'child_process';
import fetch from 'node-fetch';
import { Octokit } from '@octokit/rest';
import { validateEnvVars } from './utils/env.js';
import { sanitizeDiff } from './utils/sanitize.js';

// Executa uma função assíncrona com algumas tentativas de retry simples
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

// Função que decide aprovação automática baseada na classificação de risco da IA
function shouldApprove(review) {
  // Normaliza texto para remover acentos e ficar tudo minúsculo
  const txt = review.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Procura palavras-chave que indicam alto risco
  const proibidos = /(alta|altissima|grave|gravissima)/i;
  return !proibidos.test(txt);
}


// Solicita resposta via OpenRouter
async function callOpenRouter(messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'tngtech/deepseek-r1t2-chimera:free', messages })
  });
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta inválida da OpenRouter');
  return content;
}

// Fallback utilizando a API do Together
async function callTogether(messages) {
  const models = [
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
    'deepseek-ai/DeepSeek-R1-0528',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free'
  ];
  for (const model of models) {
    try {
      const res = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages })
      });
      if (!res.ok) {
        console.error(`Modelo ${model} falhou: ${res.status}`);
        continue;
      }
      const data = await res.json();
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
    // 0. Checagem de variáveis de ambiente obrigatórias
    validateEnvVars(['OPENROUTER_API_KEY', 'GITHUB_TOKEN']);
    const mainBranch = process.env.DEFAULT_BRANCH || 'main';
    // Valida nome da branch principal: somente letras, numeros e hifen
    // Evita riscos de path traversal em comandos git
    if (!/^[\w-]+$/.test(mainBranch)) {
      throw new Error('Nome do branch principal inválido');
    }

    // 1. Coleta o diff de forma segura (sem input externo)
    const diff = execFileSync('git', ['diff', `origin/${mainBranch}...HEAD`], { encoding: 'utf8' });
    let MAX_DIFF_SIZE = parseInt(process.env.MAX_DIFF_SIZE || '7000', 10);
    if (!Number.isFinite(MAX_DIFF_SIZE) || MAX_DIFF_SIZE <= 0) {
      MAX_DIFF_SIZE = 7000;
    }
    const trimmed = diff.length > MAX_DIFF_SIZE;
    const trimmedDiff = trimmed
      ? diff.slice(0, MAX_DIFF_SIZE) + '... [TRUNCADO]'
      : diff;
    if (trimmed) {
      console.log(`⚠️ Diff truncado (limite ${MAX_DIFF_SIZE} caracteres)`);
    }

    // 2. Sanitiza o diff para não expor segredos óbvios
    const sanitizedDiff = sanitizeDiff(trimmedDiff);

    // 3. Monta prompt para o modelo LLM
    const prompt = `
Você é um revisor sênior de código.  
Analise apenas o diff abaixo, sem considerar contexto externo ou fazer suposições.

**Instruções:**
- Liste somente problemas reais, bugs ou riscos visíveis no diff.
- Para cada problema, indique uma das classificações de risco: **baixa**, **média** ou **alta**.
- Se não houver problemas críticos, responda: "Nenhum problema crítico identificado."
- Ao final, forneça uma **classificação geral do risco do PR**: baixa, média ou alta, justifique em 1 frase.
- Seja sucinto e claro. Não repita sugestões.
- NÃO faça recomendações genéricas ou baseadas em hipóteses.
- Responda em português.

# Diff a ser analisado:
${sanitizedDiff}
`;

    // 4. Monta mensagens e tenta a OpenRouter, com fallback para Together
    const messages = [
      { role: 'system', content: 'Você é um code reviewer experiente.' },
      { role: 'user', content: prompt }
    ];

    let review;
    try {
      review = await callOpenRouter(messages);
    } catch (err) {
      console.error('OpenRouter falhou:', err.message);
      if (!process.env.TOGETHER_API_KEY) throw err;
      validateEnvVars(['TOGETHER_API_KEY']);
      review = await callTogether(messages);
    }

    console.log('==== AI Code Review ====');
    console.log(review);

    // 5. Decide aprovação ou não baseado na classificação de risco
    const approve = shouldApprove(review);

    // 6. Cria o review oficial (APPROVE ou REQUEST_CHANGES)
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    const prNumber = process.env.PR_NUMBER;

    if (prNumber) {
      // 6.2 Emite aprovação ou solicita mudanças (review oficial)
      await callWithRetry(
        () =>
          octokit.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            body: review,
            event: approve ? 'APPROVE' : 'REQUEST_CHANGES',
          }),
        'Registrar review'
      );

      console.log(
        approve
          ? 'PR aprovado automaticamente pela IA! 🚀'
          : 'Risco ALTO: mudanças solicitadas pela IA! ⚠️'
      );
    } else {
      console.log('PR_NUMBER não definido.');
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Erro durante execução:', err.message);
    } else {
      console.error('Erro durante execução:', err.stack || err);
    }
    process.exit(1);
  }
})();
