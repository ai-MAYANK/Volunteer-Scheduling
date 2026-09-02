require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));

app.get('/', (req, res) => res.json({ status: 'API running' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.use('/api/programs', require('./routes/programs'));

app.use('/api/shifts', require('./routes/shifts'));

app.use('/api/shifts', require('./routes/signups'));

app.use('/api/notifications', require('./routes/notifications'));

app.use('/api/alerts', require('./routes/alerts'));