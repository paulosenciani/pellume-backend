const express = require("express");
const redis = require("redis");

// =======================================================================
// --- MODO DE INVESTIGAÇÃO ---
// =======================================================================

async function startServer() {
  // --- 1. CONFIGURAÇÕES ---
  const app = express();
  app.use(express.json());

  const PORT = process.env.PORT || 3000;
  const SECRET_KEY = process.env.SECRET_KEY;
  const REDIS_URL = process.env.REDIS_URL;

  let redisClient;
  let redisConnectionError = null;

  // --- 2. TENTATIVA DE CONEXÃO COM O REDIS ---
  if (REDIS_URL) {
    console.log("🔌 [TESTE] Tentando conectar ao Redis...");
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => {
      console.error('❌ [TESTE] Erro no Cliente Redis:', err);
      redisConnectionError = err.message;
    });
    try {
      await redisClient.connect();
      console.log("✅ [TESTE] Conexão com Redis estabelecida com sucesso.");
    } catch (err) {
      console.error("❌ [TESTE] Falha CATASTRÓFICA ao conectar no Redis:", err);
      redisConnectionError = err.message;
    }
  } else {
    console.error("❌ [TESTE] ERRO FATAL: A variável de ambiente REDIS_URL não foi encontrada.");
    redisConnectionError = "REDIS_URL não definida.";
  }

  // --- 3. ROTAS DE DIAGNÓSTICO ---

  // Teste 1: O servidor está vivo?
  // Se esta rota funcionar, sabemos que o Express está OK.
  app.get("/teste-servidor", (req, res) => {
    console.log("✅ [TESTE] Rota /teste-servidor foi chamada com sucesso.");
    res.status(200).json({
      message: "SUCESSO: O servidor Express está no ar e respondendo."
    });
  });

  // Teste 2: Como está a conexão com o Redis?
  // Esta rota nos diz o estado da nossa dependência mais crítica.
  app.get("/teste-redis", (req, res) => {
    console.log("✅ [TESTE] Rota /teste-redis foi chamada.");
    if (redisClient && redisClient.isOpen) {
      res.status(200).json({
        status: "Conectado",
        message: "SUCESSO: A conexão com o Redis está ativa e saudável."
      });
    } else {
      res.status(500).json({
        status: "Desconectado",
        message: "FALHA: Não foi possível estabelecer ou manter a conexão com o Redis.",
        error: redisConnectionError
      });
    }
  });

  // Teste 3: A publicação no Redis está funcionando?
  // Este é o teste final, que simula a ação da nossa rota de negócio.
  app.post("/teste-publicacao", async (req, res) => {
    console.log("✅ [TESTE] Rota /teste-publicacao foi chamada.");
    if (!redisClient || !redisClient.isOpen) {
      return res.status(500).json({ message: "FALHA: Não é possível publicar porque o Redis está desconectado." });
    }
    try {
      const testePayload = { teste: "ola mundo", timestamp: new Date() };
      await redisClient.publish('fila-de-teste', JSON.stringify(testePayload));
      console.log("✅ [TESTE] Publicação no Redis realizada com sucesso.");
      res.status(200).json({ message: "SUCESSO: A publicação na fila do Redis funcionou." });
    } catch (error) {
      console.error("❌ [TESTE] Erro ao tentar publicar no Redis:", error);
      res.status(500).json({
        message: "FALHA: A publicação no Redis falhou.",
        error: error.message
      });
    }
  });

  // Rota de Health Check para a Railway (simples e direta)
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // --- 4. INICIALIZAÇÃO DO SERVIDOR ---
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor de DIAGNÓSTICO rodando na porta ${PORT}.`);
  });
}

startServer().catch(error => {
  console.error("💥 Falha catastrófica ao iniciar o servidor de diagnóstico:", error);
  process.exit(1);
});
