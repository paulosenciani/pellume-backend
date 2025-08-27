const express = require("express");
const redis = require("redis");

// --- CONFIGURAÇÃO ---
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;
const REDIS_URL = process.env.REDIS_URL; // Será fornecido pela Railway

if (!REDIS_URL || !SECRET_KEY) {
  console.error("ERRO FATAL: As variáveis de ambiente REDIS_URL e SECRET_KEY são obrigatórias.");
  process.exit(1); // Impede o servidor de iniciar sem as configurações
}

// --- CLIENTE REDIS ---
const redisClient = redis.createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => console.error('Erro no Cliente Redis:', err));

// Conectar ao Redis assim que o servidor iniciar.
redisClient.connect().then(() => {
    console.log("✅ Conectado ao Redis com sucesso.");
}).catch(err => {
    console.error("❌ Falha ao conectar com o Redis:", err);
    process.exit(1);
});


// --- ROTAS ---

// Rota de Health Check para a Railway
app.get("/health", (req, res) => {
  // Verifica se o cliente Redis ainda está conectado
  if (redisClient.isOpen) {
    res.status(200).json({ status: "healthy", redis: "connected" });
  } else {
    res.status(503).json({ status: "unhealthy", redis: "disconnected" });
  }
});

// Rota principal que recebe os dados e envia para a fila
app.post("/criar-conta", async (req, res) => {
  // 1. Validação da Chave de API
  const headerSecret = req.headers["x-api-key"];
  if (headerSecret !== SECRET_KEY) {
    return res.status(403).json({ message: "Chave de API inválida" });
  }

  // 2. Validação dos Dados de Entrada
  const { email, nome } = req.body;
  if (!email || !nome) {
    return res.status(400).json({ message: "E-mail e nome são obrigatórios." });
  }

  // 3. Publicação da Tarefa na Fila
  try {
    const tarefa = {
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      timestamp: new Date().toISOString()
    };

    // Publica a tarefa no canal 'fila-de-trabalho'
    await redisClient.publish('fila-de-trabalho', JSON.stringify(tarefa));
    
    console.log(`[Publicado] Tarefa para ${tarefa.email} enviada para a fila.`);
    
    // 4. Resposta Imediata de Sucesso
    // Informa ao cliente que a solicitação foi aceita e será processada.
    return res.status(202).json({ message: "Solicitação recebida e em processamento." });

  } catch (error) {
    console.error("❌ Erro ao publicar tarefa no Redis:", error);
    return res.status(500).json({ message: "Erro interno ao processar a solicitação." });
  }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Web (Recepcionista) rodando na porta ${PORT}`);
});
