const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const clientRoutes = require('./routes/clientRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const billingRoutes = require('./routes/billingRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/billing', billingRoutes);


module.exports = app;