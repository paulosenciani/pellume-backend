const express = require("express");
const redis = require("redis");

// --- CONFIGURAÇÃO ---
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
const REDIS_URL = process.env.REDIS_URL;

let redisClient;
let isRedisConnected = false;

// Função para iniciar e gerenciar a conexão com o Redis
const connectToRedis = () => {
  // Se já tivermos um cliente, desconectamos o antigo primeiro
  if (redisClient) {
    redisClient.quit();
  }

  console.log("Tentando conectar ao Redis...");
  redisClient = redis.createClient({ url: REDIS_URL });

  redisClient.on('error', (err) => {
    console.error('Erro no Cliente Redis:', err);
    isRedisConnected = false;
    // Tenta reconectar após um tempo se ocorrer um erro
    setTimeout(connectToRedis, 5000); 
  });

  redisClient.on('connect', () => console.log('Conectando ao Redis...'));
  redisClient.on('ready', () => {
    isRedisConnected = true;
    console.log("✅ Conexão com Redis estabelecida e pronta.");
  });
  redisClient.on('end', () => {
    isRedisConnected = false;
    console.warn("⚠️ Conexão com Redis encerrada. Tentando reconectar...");
    setTimeout(connectToRedis, 5000);
  });

  // A conexão inicial é feita aqui
  redisClient.connect().catch(err => {
    console.error("Falha na tentativa inicial de conexão com o Redis:", err);
  });
};

// --- ROTAS ---

app.get("/health", (req, res) => {
  if (isRedisConnected) {
    res.status(200).json({ status: "healthy", redis: "connected" });
  } else {
    res.status(503).json({ status: "unhealthy", redis: "disconnected" });
  }
});

app.post("/criar-conta", async (req, res) => {
  const headerSecret = req.headers["x-api-key"];
  if (headerSecret !== SECRET_KEY) {
    return res.status(403).json({ message: "Chave de API inválida" });
  }

  if (!isRedisConnected) {
    return res.status(503).json({ message: "Serviço temporariamente indisponível, reconectando ao banco de dados." });
  }

  const { email, nome } = req.body;
  if (!email || !nome) {
    return res.status(400).json({ message: "E-mail e nome são obrigatórios." });
  }

  try {
    const tarefa = {
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      timestamp: new Date().toISOString()
    };
    
    // Tentamos publicar a tarefa
    await redisClient.publish('fila-de-trabalho', JSON.stringify(tarefa));
    
    console.log(`[Publicado] Tarefa para ${tarefa.email} enviada para a fila.`);
    return res.status(202).json({ message: "Solicitação recebida e em processamento." });

  } catch (error) {
    console.error("❌ Erro CRÍTICO ao publicar no Redis:", error);
    // Se a publicação falhar, informamos o cliente e não derrubamos o servidor.
    return res.status(500).json({ message: "Erro interno ao enfileirar a solicitação. Por favor, tente novamente." });
  }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Web (Recepcionista) rodando na porta ${PORT}.`);
  // Inicia o processo de conexão com o Redis DEPOIS que o servidor está no ar.
  if (REDIS_URL) {
    connectToRedis();
  } else {
    console.error("ERRO FATAL: A variável de ambiente REDIS_URL não foi encontrada.");
  }
});
