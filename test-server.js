const express = require('express');
const cors = require('cors');

const app = express();

// Simple middleware - no database connection
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Marketplace Manager API - Test Mode', timestamp: new Date().toISOString() });
});

app.get('/test', (req, res) => {
  res.json({ status: 'OK', message: 'Test endpoint working' });
});

// Mock auth endpoints for testing
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email, password: '***' });

  // Simple mock authentication
  if (email && password) {
    res.json({
      token: 'mock-jwt-token-for-testing',
      user: { id: 'test-user', name: 'Test User', email: email }
    });
  } else {
    res.status(400).json({ message: 'Email and password required' });
  }
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  console.log('Forgot password request:', email);

  res.json({
    message: 'If an account with that email exists, a password reset link has been sent. (Test mode - check console)'
  });
});

const PORT = 5002; // Use different port to avoid conflicts
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📝 Test endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/`);
  console.log(`   GET  http://localhost:${PORT}/test`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   POST http://localhost:${PORT}/api/auth/forgot-password`);
});
