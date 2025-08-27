const redis = require("redis");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// =======================================================================
// --- CONFIGURAÇÃO E INICIALIZAÇÃO DO TRABALHADOR ---
// =======================================================================

console.log("[Trabalhador] Iniciando...");

// Carrega as variáveis de ambiente
const REDIS_URL = process.env.REDIS_URL;
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_CREDENTIALS_JSON;
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

// Validação crítica das variáveis
if (!REDIS_URL || !GOOGLE_CREDENTIALS_JSON || !EMAIL_CONFIG.auth.user) {
  console.error("❌ ERRO FATAL: Variáveis de ambiente essenciais (REDIS_URL, GOOGLE_CREDENTIALS_JSON, etc.) não foram definidas.");
  process.exit(1);
}

// Inicializa o Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(GOOGLE_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ [Trabalhador] Conexão com Firebase estabelecida.");
} catch (error) {
  console.error("❌ ERRO FATAL: Falha ao inicializar o Firebase. Verifique as credenciais.", error);
  process.exit(1);
}

const db = admin.firestore();

// =======================================================================
// --- LÓGICA DE NEGÓCIO (O "TRABALHO PESADO") ---
// =======================================================================

// Função para gerar senha aleatória
function gerarSenha() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let senha = '';
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

// Função para enviar e-mail de boas-vindas
async function enviarEmailBoasVindas(email, senha, nome) {
  const transporter = nodemailer.createTransport(EMAIL_CONFIG);
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #805B40; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #805B40; }
        .button { display: inline-block; background: #805B40; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><h1>🎉 Seja bem-vinda ao seu Guia Definitivo de Skincare!</h1></div>
        <div class="content">
          <p>Olá <strong>${nome}</strong>,</p>
          <p>Parabéns! Sua conta foi criada com sucesso.</p>
          <div class="credentials">
            <h3>📧 Seus Dados de Acesso:</h3>
            <p><strong>E-mail:</strong> ${email}</p>
            <p><strong>Senha:</strong> ${senha}</p>
          </div>
          <a href="https://pellume.com/login" class="button">🔐 Fazer Login Agora</a>
          <p>Atenciosamente,  
<strong>Equipe Pellume</strong></p>
        </div>
      </div>
    </body>
    </html>`;
  const mailOptions = {
    from: `"Equipe Pellume" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🎉 Bem-vinda! Seus dados de acesso à plataforma',
    html: htmlTemplate
  };
  await transporter.sendMail(mailOptions );
}

// Função principal que processa a tarefa recebida do Redis
async function processarCriacaoDeConta(tarefa) {
  const { email, nome } = tarefa;
  console.log(`[Processando] Iniciando tarefa para: ${email}`);
  try {
    let userRecord;
    const senhaGerada = gerarSenha();
    
    // Lógica de criar ou atualizar usuário no Firebase Auth
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password: senhaGerada, displayName: nome });
      console.log(`[Processando] Usuário existente ${email} atualizado.`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        userRecord = await admin.auth().createUser({ email, password: senhaGerada, displayName: nome });
        console.log(`[Processando] Novo usuário ${email} criado.`);
      } else {
        throw error; // Lança outros erros do Auth para o catch principal
      }
    }
    
    // Salva no Firestore
    await db.collection("users").doc(userRecord.uid).set({ email, nome, dataCriacao: admin.firestore.FieldValue.serverTimestamp(), ativo: true }, { merge: true });
    
    // Envia o e-mail de boas-vindas
    await enviarEmailBoasVindas(email, senhaGerada, nome);
    
    console.log(`✅ [Sucesso] Tarefa concluída para: ${email}`);

  } catch (error) {
    console.error(`❌ [Erro] Falha ao processar tarefa para ${email}:`, error);
    // No futuro, podemos adicionar uma lógica para reenviar a tarefa ou notificar um erro.
  }
}

// =======================================================================
// --- CONEXÃO COM REDIS E INÍCIO DO TRABALHO ---
// =======================================================================

async function iniciarTrabalhador() {
  const redisClient = redis.createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => console.error('Erro no Cliente Redis do Trabalhador:', err));
  
  try {
    await redisClient.connect();
    console.log("✅ [Trabalhador] Conectado ao Redis e ouvindo a 'fila-de-trabalho'.");

    // O trabalhador se inscreve no canal 'fila-de-trabalho'
    await redisClient.subscribe('fila-de-trabalho', (message) => {
      try {
        const tarefa = JSON.parse(message);
        // Chama a função que contém toda a sua lógica de negócio
        processarCriacaoDeConta(tarefa);
      } catch (e) {
        console.error("Erro ao parsear mensagem da fila:", message, e);
      }
    });
  } catch (err) {
    console.error("❌ [Trabalhador] Falha fatal ao conectar/inscrever no Redis:", err);
    process.exit(1);
  }
}

// Inicia o processo
iniciarTrabalhador();
