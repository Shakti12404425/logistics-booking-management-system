const express = require('express');
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || '';
const ADMIN_EMAIL = 'rajutransport27@gmail.com';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = 'raju_transport_secret_2024';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');

// Initialize data files
function initDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([]));
  if (!fs.existsSync(RESET_TOKENS_FILE)) fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify({}));
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Phone Register ───────────────────────────────────────────────────────────
app.post('/api/auth/phone-register', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.phone === phone)) return res.status(400).json({ error: 'Phone number already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), phone, password: hashed, createdAt: new Date().toISOString() };
  users.push(user);
  writeJSON(USERS_FILE, users);

  const token = jwt.sign({ id: user.id, phone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, phone } });
});

// ─── Phone Login ──────────────────────────────────────────────────────────────
app.post('/api/auth/phone-login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.phone === phone);
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ id: user.id, phone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, phone } });
});

// Email/Password Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, password: hashed, createdAt: new Date().toISOString() };
  users.push(user);
  writeJSON(USERS_FILE, users);

  const token = jwt.sign({ id: user.id, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, email } });
});

// Email/Password Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign({ id: user.id, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, email } });
});

// ─── Admin Forgot Password ────────────────────────────────────────────────────

app.post('/api/admin/forgot-password', async (req, res) => {
  const token = uuidv4();
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

  const tokens = JSON.parse(fs.readFileSync(RESET_TOKENS_FILE, 'utf8'));
  tokens[token] = { expiresAt };
  fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(tokens, null, 2));

  const resetLink = `${BASE_URL}/admin-reset.html?token=${token}`;

  if (!GMAIL_USER || !GMAIL_PASS) {
    console.log(`🔑 Reset link (dev mode): ${resetLink}`);
    return res.json({ success: true, devLink: resetLink });
  }

  try {
    await mailer.sendMail({
      from: `"Raju Transport" <${GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: '🔐 Admin Password Reset – Raju Transport',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <span style="font-size:40px">🚛</span>
            <h2 style="color:#1a1a2e;margin:8px 0">Raju Transport</h2>
            <p style="color:#666;font-size:14px">Admin Password Reset</p>
          </div>
          <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e0e0e0">
            <p style="color:#2d2d2d;font-size:15px">You requested a password reset for the admin panel.</p>
            <p style="color:#2d2d2d;font-size:15px">Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${resetLink}" style="background:#e85d04;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
                Reset Password
              </a>
            </div>
            <p style="color:#999;font-size:12px">If you didn't request this, ignore this email. Your password won't change.</p>
            <p style="color:#999;font-size:12px;word-break:break-all">Or copy this link: ${resetLink}</p>
          </div>
        </div>
      `
    });
    res.json({ success: true, message: `Reset link sent to ${ADMIN_EMAIL}` });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Failed to send email. Check Gmail credentials.' });
  }
});

app.post('/api/admin/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Valid token and password (min 6 chars) required' });
  }

  const tokens = JSON.parse(fs.readFileSync(RESET_TOKENS_FILE, 'utf8'));
  const record = tokens[token];

  if (!record) return res.status(400).json({ error: 'Invalid or already used reset link' });
  if (Date.now() > record.expiresAt) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

  // Save new hashed password to a config file
  const hashed = await bcrypt.hash(newPassword, 10);
  const adminConfigFile = path.join(DATA_DIR, 'admin_config.json');
  fs.writeFileSync(adminConfigFile, JSON.stringify({ passwordHash: hashed }, null, 2));

  // Invalidate token
  delete tokens[token];
  fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(tokens, null, 2));

  res.json({ success: true, message: 'Password updated successfully' });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  const { adminId, password } = req.body;
  const ADMIN_ID = 'admin';
  const DEFAULT_PASS = 'raju@admin2024';

  if (adminId !== ADMIN_ID) return res.status(400).json({ error: 'Invalid admin ID' });

  // Check if a custom password has been set via reset
  const adminConfigFile = path.join(DATA_DIR, 'admin_config.json');
  if (fs.existsSync(adminConfigFile)) {
    const { passwordHash } = JSON.parse(fs.readFileSync(adminConfigFile, 'utf8'));
    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) return res.status(400).json({ error: 'Invalid password' });
  } else {
    if (password !== DEFAULT_PASS) return res.status(400).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin', adminId }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

app.get('/api/admin/submissions', adminMiddleware, (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  const { search, loadType } = req.query;

  let filtered = submissions;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(sub =>
      sub.fullName?.toLowerCase().includes(s) ||
      sub.mobile?.includes(s) ||
      sub.email?.toLowerCase().includes(s) ||
      sub.goodsType?.toLowerCase().includes(s)
    );
  }
  if (loadType) {
    filtered = filtered.filter(sub => sub.loadType === loadType);
  }

  res.json({ success: true, submissions: filtered.reverse() });
});

app.get('/api/admin/export', adminMiddleware, (req, res) => {
  const submissions = readJSON(SUBMISSIONS_FILE);
  const headers = ['ID', 'Full Name', 'Mobile', 'Email', 'Type of Goods', 'Load Type', 'Submitted At'];
  const rows = submissions.map(s => [
    s.id, s.fullName, s.mobile, s.email || '', s.goodsType, s.loadType,
    new Date(s.createdAt).toLocaleString()
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(v => `"${v}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
  res.send(csv);
});

// ─── Submission Routes ────────────────────────────────────────────────────────

app.post('/api/submissions', authMiddleware, (req, res) => {
  const { fullName, mobile, email, goodsType, loadType } = req.body;

  if (!fullName || !mobile || !goodsType || !loadType) {
    return res.status(400).json({ error: 'Required fields missing' });
  }
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Valid 10-digit mobile number required' });
  }

  const submissions = readJSON(SUBMISSIONS_FILE);
  const submission = {
    id: uuidv4(),
    userId: req.user.id,
    fullName, mobile, email: email || '', goodsType, loadType,
    createdAt: new Date().toISOString()
  };
  submissions.push(submission);
  writeJSON(SUBMISSIONS_FILE, submissions);

  res.json({ success: true, submission });
});

// ─── Page Routes ──────────────────────────────────────────────────────────────

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/admin-reset', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-reset.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

initDataFiles();
app.listen(PORT, () => {
  console.log(`🚛 Raju Transport server running at http://localhost:${PORT}`);
  console.log(`🔑 Admin credentials: ID=admin | Password=raju@admin2024`);

  if (GMAIL_USER && GMAIL_PASS) {
    mailer.verify((err) => {
      if (err) {
        console.error(`❌ Gmail connection failed: ${err.message}`);
        console.error(`   Check GMAIL_USER and GMAIL_PASS in your .env file`);
      } else {
        console.log(`✅ Gmail connected — emails will be sent from ${GMAIL_USER}`);
      }
    });
  } else {
    console.warn(`⚠️  Email not configured. Add GMAIL_USER and GMAIL_PASS to .env`);
    console.warn(`   Reset links will be shown in the browser (dev mode) until then.`);
  }
});
