// Legacy Thermometer - Express server
// Serves the public dashboard, pledge form, admin backend, and a small JSON API.
const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// --- Optional email notifications (nodemailer) ---
// Configured entirely via env vars. If SMTP_HOST + NOTIFY_TO aren't set,
// notifications are silently skipped so the app still runs anywhere.
const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
  NOTIFY_TO, NOTIFY_FROM,
} = process.env;
let mailer = null;
try {
  if (SMTP_HOST && NOTIFY_TO) {
    const nodemailer = require('nodemailer');
    const port = Number(SMTP_PORT) || 587;
    mailer = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    console.log(`Email notifications ON → ${NOTIFY_TO}`);
  } else {
    console.log('Email notifications OFF (set SMTP_HOST and NOTIFY_TO to enable).');
  }
} catch (e) {
  console.warn('nodemailer unavailable, email notifications disabled:', e.message);
}

function notifyPledge(p) {
  if (!mailer) return;
  const cur = db.getSetting('currency', '₦');
  const money = (n) => cur + Number(n).toLocaleString();
  const t = stats();
  const subject = `New pledge: ${money(p.amount)} from ${p.name}`;
  const html = `
    <h2 style="font-family:Arial,sans-serif;color:#005028;margin:0 0 8px">New pledge received 🏊</h2>
    <p style="font-family:Arial,sans-serif;margin:0 0 16px;color:#333">${t.campaign_name}</p>
    <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;color:#667"><b>Name</b></td><td>${esc(p.name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#667"><b>Email</b></td><td>${esc(p.email)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#667"><b>Phone</b></td><td>${esc(p.phone || '—')}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#667"><b>Child's name</b></td><td>${esc(p.child_name || 'N/A')}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#667"><b>Amount</b></td><td style="color:#0b6e9e;font-weight:bold">${money(p.amount)}</td></tr>
      ${p.note ? `<tr><td style="padding:4px 12px 4px 0;color:#667"><b>Message</b></td><td>${esc(p.note)}</td></tr>` : ''}
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px;margin-top:16px;color:#333">
      Running totals — Pledged: <b>${money(t.pledged)}</b> of <b>${money(t.target)}</b>
      (${t.target > 0 ? Math.round(t.pledged / t.target * 100) : 0}%) &middot; ${t.pledge_count} pledges.
    </p>`;
  mailer.sendMail({
    from: NOTIFY_FROM || SMTP_USER || 'no-reply@localhost',
    to: NOTIFY_TO,
    subject,
    html,
    text: `New pledge: ${money(p.amount)} from ${p.name} (${p.email}). Total pledged ${money(t.pledged)} of ${money(t.target)}.`,
  }).catch((e) => console.error('Email send failed:', e.message));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
function stats() {
  const t = db.totals();
  const target = Number(db.getSetting('target', '0')) || 0;
  return {
    campaign_name: db.getSetting('campaign_name', 'Legacy Fund'),
    currency: db.getSetting('currency', '₦'),
    target,
    pledged: t.pledged,
    fulfilled: t.fulfilled,
    pledge_count: t.count,
  };
}

function requireAdmin(req, res, next) {
  const pwd = req.headers['x-admin-password'] || req.query.password || (req.body && req.body.password);
  if (pwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Wrong admin password.' });
  }
  next();
}

// --- Public API ---
// Live stats for the thermometer.
app.get('/api/stats', (req, res) => res.json(stats()));

// Create a pledge (public pledge form posts here).
app.post('/api/pledges', (req, res) => {
  const { name, email, phone, child_name, amount, note } = req.body || {};
  const amt = Number(amount);
  if (!name || !email || !amt || amt <= 0) {
    return res.status(400).json({ error: 'Name, email and a positive pledge amount are required.' });
  }
  const row = db.addPledge({
    name: String(name).trim(),
    email: String(email).trim(),
    phone: phone ? String(phone).trim() : null,
    child_name: child_name ? String(child_name).trim() : 'N/A',
    amount: amt,
    note: note ? String(note).trim() : null,
  });
  notifyPledge(row); // fire-and-forget email
  res.json({ ok: true, stats: stats() });
});

// --- Admin API (password protected) ---
app.get('/api/admin/pledges', requireAdmin, (req, res) => {
  res.json({ stats: stats(), pledges: db.listPledges() });
});

// Export all pledges as CSV (download). Auth via ?password= so it works as a link.
app.get('/api/admin/pledges.csv', requireAdmin, (req, res) => {
  const rows = db.listPledges();
  const headers = ['id', 'name', 'email', 'phone', 'child_name', 'amount', 'fulfilled', 'status', 'note', 'created_at'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  for (const p of rows) {
    const status = p.fulfilled >= p.amount ? 'Fulfilled' : p.fulfilled > 0 ? 'Partial' : 'Pending';
    lines.push([p.id, cell(p.name), cell(p.email), cell(p.phone), cell(p.child_name),
      p.amount, p.fulfilled, status, cell(p.note), p.created_at].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="aquatic-centre-pledges-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('﻿' + lines.join('\r\n')); // BOM so Excel reads UTF-8 (₦) correctly
});

// Update the amount fulfilled for a single pledge.
app.post('/api/admin/pledges/:id/fulfill', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.getPledge(id);
  if (!row) return res.status(404).json({ error: 'Pledge not found.' });
  let fulfilled = Number(req.body.fulfilled);
  if (isNaN(fulfilled) || fulfilled < 0) return res.status(400).json({ error: 'Invalid fulfilled amount.' });
  db.setFulfilled(id, fulfilled);
  res.json({ ok: true, stats: stats() });
});

app.post('/api/admin/pledges/:id/delete', requireAdmin, (req, res) => {
  db.deletePledge(Number(req.params.id));
  res.json({ ok: true, stats: stats() });
});

// Update campaign settings (target, name, currency).
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { target, campaign_name, currency } = req.body || {};
  if (target !== undefined && !isNaN(Number(target))) db.setSetting('target', Number(target));
  if (campaign_name) db.setSetting('campaign_name', campaign_name);
  if (currency) db.setSetting('currency', currency);
  res.json({ ok: true, stats: stats() });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/pledge', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pledge.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`Legacy Thermometer running on http://localhost:${PORT}`);
  console.log(`  Dashboard: /   |   Pledge form: /pledge   |   Admin: /admin`);
});
