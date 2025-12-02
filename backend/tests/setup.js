const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
  // Garante desconexão prévia
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // Cria o servidor
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
  process.env.MONGO_LEGACY_URI = uri; 
  process.env.JWT_SECRET = 'segredo_fixo_para_testes_123';

  // Conecta com timeout maior para evitar flakiness
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000
  });
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