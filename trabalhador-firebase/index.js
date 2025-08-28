const redis = require("redis");
const admin = require("firebase-admin");
const sgMail = require('@sendgrid/mail'); // 1. Importa a biblioteca correta

// =======================================================================
// --- CONFIGURAÇÃO E INICIALIZAÇÃO DO TRABALHADOR ---
// =======================================================================

console.log("[Trabalhador] Iniciando...");

// Carrega as variáveis de ambiente
const REDIS_URL = process.env.REDIS_URL;
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_CREDENTIALS_JSON;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; // 2. Carrega a nova chave de API
const FROM_EMAIL = "contato@pellume.com"; // 3. Defina seu e-mail verificado no SendGrid

// Validação crítica das variáveis
if (!REDIS_URL || !GOOGLE_CREDENTIALS_JSON || !SENDGRID_API_KEY) {
  console.error("❌ ERRO FATAL: Variáveis de ambiente essenciais (REDIS_URL, GOOGLE_CREDENTIALS_JSON, SENDGRID_API_KEY) não foram definidas.");
  process.exit(1);
}

// Configura o SendGrid
sgMail.setApiKey(SENDGRID_API_KEY);

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

// Função para gerar senha aleatória (sem alterações)
function gerarSenha() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let senha = '';
  for (let i = 0; i < 8; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
}

// 4. Função de e-mail REESCRITA para usar SendGrid
async function enviarEmailBoasVindas(email, senha, nome) {
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

           <!-- SEÇÃO ADICIONADA -->
          <div class="important-notes">
            <p><strong>⚠️ Importante:</strong></p>
            <ul>
              <li>Se você recebeu este e-mail mais de uma vez, esta é a sua senha mais recente e válida.</li>
              <li>Guarde esses dados em local seguro.</li>
              <li>Não compartilhe sua senha com terceiros.</li>
              <li>Em caso de dúvidas, entre em contato conosco.</li>
            </ul>
            <p>Aproveite seu Guia Definitivo e transforme sua rotina de skincare!</p>
          </div>
          <!-- FIM DA SEÇÃO ADICIONADA -->
          
          <p>Atenciosamente,  
<strong>Equipe Pellume</strong></p>
        </div>
      </div>
    </body>
    </html>`;

  const msg = {
    to: email,
    from: {
      name: 'Equipe Pellume',
      email: FROM_EMAIL,
    },
    subject: '🎉 Bem-vinda! Seus dados de acesso à plataforma',
    html: htmlTemplate,
  };

  try {
    await sgMail.send(msg );
    console.log(`✅ E-mail de boas-vindas enviado para ${email} via SendGrid.`);
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail via SendGrid para ${email}:`);
    // O erro do SendGrid é rico em detalhes, então o registramos
    if (error.response) {
      console.error(error.response.body);
    } else {
      console.error(error);
    }
    // Lançamos o erro para que o catch principal saiba que o envio falhou
    throw error;
  }
}

// Função principal que processa a tarefa (sem alterações na lógica principal)
async function processarCriacaoDeConta(tarefa) {
  const { email, nome } = tarefa;
  console.log(`[Processando] Iniciando tarefa para: ${email}`);
  try {
    let userRecord;
    const senhaGerada = gerarSenha();
    
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password: senhaGerada, displayName: nome });
      console.log(`[Processando] Usuário existente ${email} atualizado.`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        userRecord = await admin.auth().createUser({ email, password: senhaGerada, displayName: nome });
        console.log(`[Processando] Novo usuário ${email} criado.`);
      } else {
        throw error;
      }
    }
    
    await db.collection("users").doc(userRecord.uid).set({ email, nome, dataCriacao: admin.firestore.FieldValue.serverTimestamp(), ativo: true }, { merge: true });
    await enviarEmailBoasVindas(email, senhaGerada, nome);
    console.log(`✅ [Sucesso] Tarefa concluída para: ${email}`);

  } catch (error) {
    console.error(`❌ [Erro] Falha ao processar tarefa para ${email}:`, error.message);
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
    // Usamos 'duplicate' para criar um cliente dedicado a 'subscribe'
    // Isso é uma boa prática para evitar conflitos de comando no Redis
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    
    console.log("✅ [Trabalhador] Conectado ao Redis e ouvindo a 'fila-de-trabalho'.");

    await subscriber.subscribe('fila-de-trabalho', (message) => {
      try {
        const tarefa = JSON.parse(message);
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
