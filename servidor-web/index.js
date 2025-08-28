const express = require("express");

// =======================================================================
// --- MODO DE INVESTIGAÇÃO DE VARIÁVEIS ---
// =======================================================================

const app = express();
const PORT = process.env.PORT || 3000; // Usamos uma porta padrão caso a variável não exista

// Lemos todas as variáveis que nosso aplicativo precisa
const SECRET_KEY = process.env.SECRET_KEY;
const REDIS_URL = process.env.REDIS_URL;
const GOOGLE_CREDENTIALS_JSON_EXISTS = !!process.env.GOOGLE_CREDENTIALS_JSON; // Apenas verificamos se existe

console.log("========================================");
console.log("INÍCIO DO TESTE DE DIAGNÓSTICO DE VARIÁVEIS");
console.log(`[INFO] Tentando iniciar na porta: ${PORT}`);

// Verificamos e registramos o status de cada variável
console.log(`[VAR] SECRET_KEY: ${SECRET_KEY ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
console.log(`[VAR] REDIS_URL: ${REDIS_URL ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
console.log(`[VAR] GOOGLE_CREDENTIALS_JSON: ${GOOGLE_CREDENTIALS_JSON_EXISTS ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
console.log("========================================");


// Criamos uma rota de diagnóstico que mostra as variáveis
app.get("/diagnostico", (req, res) => {
  res.status(200).json({
    message: "Relatório de diagnóstico do servidor.",
    variaveis: {
      SECRET_KEY: SECRET_KEY ? 'Encontrada' : 'NÃO ENCONTRADA',
      REDIS_URL: REDIS_URL ? 'Encontrada' : 'NÃO ENCONTRADA',
      GOOGLE_CREDENTIALS_JSON: GOOGLE_CREDENTIALS_JSON_EXISTS ? 'Encontrada' : 'NÃO ENCONTRADA'
    }
  });
});

// Rota de Health Check para a Railway
app.get("/health", (req, res) => {
  // Apenas responde OK para passar na verificação
  res.status(200).send("OK");
});


// O servidor só começa a ouvir o mundo no final de tudo.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de DIAGNÓSTICO rodando e pronto para receber requisições.`);
});


startServer().catch(error => {
  console.error("💥 Falha catastrófica ao iniciar o servidor:", error);
  process.exit(1);
});
