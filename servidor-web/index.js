const express = require("express");
const redis = require("redis");

async function startServer() {
  const app = express();
  app.use(express.json());

  const PORT = process.env.PORT || 3000;
  const SECRET_KEY = process.env.SECRET_KEY;
  const REDIS_URL = process.env.REDIS_URL;

  if (!REDIS_URL) {
    throw new Error("FATAL: REDIS_URL não está definida.");
  }

  console.log("🔌 Conectando ao Redis...");
  const redisClient = redis.createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => console.error('❌ Erro no Cliente Redis:', err));
  await redisClient.connect();
  console.log("✅ Conexão com Redis estabelecida.");

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  app.post("/criar-conta", async (req, res) => {
    const headerSecret = req.headers["x-api-key"];
    if (headerSecret !== SECRET_KEY) {
      return res.status(403).json({ message: "Chave de API inválida" });
    }
    const { email, nome } = req.body;
    if (!email || !nome) {
      return res.status(400).json({ message: "E-mail e nome são obrigatórios." });
    }
    try {
      const tarefa = { email: email.trim().toLowerCase(), nome: nome.trim(), timestamp: new Date().toISOString() };
      await redisClient.publish('fila-de-trabalho', JSON.stringify(tarefa));
      console.log(`[Publicado] Tarefa para ${tarefa.email} enviada para a fila.`);
      return res.status(202).json({ message: "Solicitação recebida e em processamento." });
    } catch (error) {
      console.error("❌ Erro CRÍTICO ao publicar no Redis:", error);
      return res.status(500).json({ message: "Erro interno ao enfileirar a solicitação." });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Web está 100% pronto e rodando na porta ${PORT}.`);
  });
}

startServer().catch(error => {
  console.error("💥 Falha catastrófica ao iniciar o servidor:", error);
  process.exit(1);
});
