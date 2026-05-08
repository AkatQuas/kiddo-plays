require('dotenv').config();
const express = require('express');
const userRoutes = require('./routes/users');
const carRoutes = require('./routes/cars');
const otpRoutes = require('./routes/otp');
const adminRoutes = require('./routes/admin');
const { otpGuard } = require('./middleware/otpGuard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/admin', otpGuard, adminRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
