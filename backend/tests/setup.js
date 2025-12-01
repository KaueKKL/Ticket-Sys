const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  // Fecha conexões anteriores
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // TRUQUE DE MESTRE:
  // Apontamos ambas as variáveis para o mesmo banco em memória.
  // Assim, podemos "seedar" (plantar) dados falsos do ERP usando Mongoose ou Driver Nativo
  // e o seu código vai achar que está falando com o servidor real.
  process.env.MONGO_URI = uri;
  process.env.MONGO_LEGACY_URI = uri; 
  process.env.JWT_SECRET = 'segredo_fixo_para_testes_123';

  await mongoose.connect(uri);
};

const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

const clearDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
};

module.exports = { connectDB, closeDB, clearDB };