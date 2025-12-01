// Note que agora importamos do 'mongodb-legacy'
const { MongoClient } = require('mongodb-legacy');

const uri = process.env.MONGO_LEGACY_URI;
let dbInstance = null;

const connectLegacy = async () => {
  try {
    if (dbInstance) return dbInstance;

    // Configuração específica para Drivers v3.x conectarem sem erro
    const client = new MongoClient(uri, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      connectTimeoutMS: 5000
    });

    // Na versão 3.x, o connect retorna o cliente conectado
    await client.connect();
    
    console.log('🦖 Conexão Legado (Driver v3.7) estabelecida com sucesso!');
    
    // Pega o banco de dados padrão da URI
    dbInstance = client.db();
    return dbInstance;

  } catch (error) {
    console.error('❌ Falha fatal ao conectar no legado:', error);
    // Não vamos dar throw para não derrubar o servidor principal se o legado falhar
    return null;
  }
};

module.exports = connectLegacy;