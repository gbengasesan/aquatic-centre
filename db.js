// Storage layer: a tiny JSON-file database (zero native dependencies, easy to deploy).
// Holds campaign settings and individual pledges. Writes are atomic (temp file + rename).
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'legacy.json');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const DEFAULTS = {
  settings: {
    campaign_name: 'Greensprings Aquatic Centre — Legacy Fund',
    currency: '₦', // Naira
    target: 2000000000, // ₦2 billion
    deadline: '2026-07-31', // Phase 1 deadline (YYYY-MM-DD)
  },
  pledges: [],
  nextId: 1,
};

let data;
function loadFromDisk() {
  try {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // backfill any missing keys
    data.settings = Object.assign({}, DEFAULTS.settings, data.settings || {});
    data.pledges = data.pledges || [];
    data.nextId = data.nextId || (data.pledges.reduce((m, p) => Math.max(m, p.id), 0) + 1);
  } catch (e) {
    data = JSON.parse(JSON.stringify(DEFAULTS));
    save();
  }
}
function save() {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_PATH);
}
loadFromDisk();

// ---- Settings ----
function getSetting(key, fallback = null) {
  return key in data.settings ? data.settings[key] : fallback;
}
function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

// ---- Pledges ----
function addPledge(p) {
  const row = {
    id: data.nextId++,
    name: p.name,
    email: p.email,
    phone: p.phone || null,
    child_name: p.child_name || 'N/A',
    amount: Number(p.amount),
    fulfilled: 0,
    timeline: p.timeline || null,
    note: p.note || null,
    created_at: new Date().toISOString(),
  };
  data.pledges.push(row);
  save();
  return row;
}
function listPledges() {
  return [...data.pledges].sort((a, b) => b.id - a.id);
}
function getPledge(id) {
  return data.pledges.find((p) => p.id === Number(id)) || null;
}
function setFulfilled(id, amount) {
  const p = getPledge(id);
  if (p) { p.fulfilled = Number(amount); save(); }
  return p;
}
function deletePledge(id) {
  data.pledges = data.pledges.filter((p) => p.id !== Number(id));
  save();
}
function totals() {
  return data.pledges.reduce(
    (acc, p) => {
      acc.pledged += Number(p.amount) || 0;
      acc.fulfilled += Number(p.fulfilled) || 0;
      acc.count += 1;
      return acc;
    },
    { pledged: 0, fulfilled: 0, count: 0 }
  );
}

module.exports = {
  getSetting, setSetting,
  addPledge, listPledges, getPledge, setFulfilled, deletePledge, totals,
};
