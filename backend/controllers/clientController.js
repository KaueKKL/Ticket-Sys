const connectLegacy = require('../config/legacyDb');
const util = require('util');

exports.searchClients = async (req, res) => {
  try {
    const { q } = req.query;

    const db = await connectLegacy();
    if (!db) return res.status(500).json({ message: 'Sem conexão' });
    
    // Identifica nome correto da collection
    const collections = await db.listCollections().toArray();
    const tableName = collections.find(c => c.name.toLowerCase() === 'pessoas')?.name || 'Pessoas';
    const collection = db.collection(tableName);

    // 1. CONTAGEM TOTAL
    const totalDocs = await collection.countDocuments({});
    console.log(`📊 Total de registros na tabela '${tableName}': ${totalDocs}`);

    // 2. LISTAR OS NOMES DE TODOS OS REGISTROS (Já que são poucos)
    // Se tiver muitos, limitamos a 10 só para ver quem são
    const allDocs = await collection.find({})
      .project({ Nome: 1, _id: 0 })
      .limit(10)
      .toArray();

    console.log('📋 Lista de nomes encontrados neste banco:');
    allDocs.forEach(doc => console.log(`   - "${doc.Nome}"`));

    // 3. TENTA A BUSCA DO USUÁRIO
    if (!q) return res.json([]);
    
    const regex = new RegExp(`.*${q}.*`, 'i');
    const query = {
      $or: [
        { Nome: regex },
        { InformacoesPesquisa: regex }
      ]
    };
    
    const clients = await collection.find(query).limit(5).toArray();
    console.log(`🔎 Buscando por "${q}" -> Encontrados: ${clients.length}`);

    const formatted = clients.map(c => ({
      id: c._id,
      name: c.Nome,
      cpf: c.Cpf,
      phone: c.TelefoneComercial?.Numero || 'S/N',
      email: c.EmailPrincipal?.Endereco || 'S/N'
    }));

    res.json(formatted);

  } catch (error) {
    console.error('❌ ERRO:', error);
    res.status(500).json({ message: error.message });
  }
};