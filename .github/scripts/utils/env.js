export function validateEnvVars(requiredVars = []) {
  for (const name of requiredVars) {
    if (!process.env[name]) {
      throw new Error(`Variável obrigatória faltando: ${name}`);
    }
  }
}
