module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000, // 30 segundos (bancos em memória podem demorar no boot)
  verbose: true,
  // Ignora a pasta node_modules
  testPathIgnorePatterns: ['/node_modules/'],
};