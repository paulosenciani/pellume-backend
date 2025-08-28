const express = require("express");

// =======================================================================
// --- MODO DE INVESTIGAÇÃO DE VARIÁVEIS (CORRIGIDO) ---
// =======================================================================

// A DEFINIÇÃO DA FUNÇÃO QUE ESTAVA FALTANDO
async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  const SECRET_KEY = process.env.SECRET_KEY;
  const REDIS_URL = process.env.REDIS_URL;
  const GOOGLE_CREDENTIALS_JSON_EXISTS = !!process.env.GOOGLE_CREDENTIALS_JSON;

  console.log("========================================");
  console.log("INÍCIO DO TESTE DE DIAGNÓSTICO DE VARIÁVEIS");
  console.log(`[INFO] Tentando iniciar na porta: ${PORT}`);
  console.log(`[VAR] SECRET_KEY: ${SECRET_KEY ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
  console.log(`[VAR] REDIS_URL: ${REDIS_URL ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
  console.log(`[VAR] GOOGLE_CREDENTIALS_JSON: ${GOOGLE_CREDENTIALS_JSON_EXISTS ? 'Encontrada' : 'NÃO ENCONTRADA'}`);
  console.log("========================================");

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

  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de DIAGNÓSTICO rodando e pronto para receber requisições.`);
  });
}

// A CHAMADA DA FUNÇÃO (que agora existe)
startServer().catch(error => {
  console.error("💥 Falha catastrófica ao iniciar o servidor:", error);
  process.exit(1);
});
