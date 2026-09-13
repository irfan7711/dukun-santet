const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const JWT_SECRET = process.env.JWT_SECRET || 'GANTI-SEBELUM-PRODUKSI';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// ===== DATABASE SQLITE =====
fs.mkdirSync('data', { recursive: true });
fs.mkdirSync('uploads', { recursive: true });
const db = new Database(path.join('data', 'app.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT UNIQUE, password TEXT, phone TEXT
  );
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    title TEXT, type TEXT, price INTEGER,
    address TEXT, city TEXT, description TEXT,
    lat REAL, lng REAL,
    bedrooms INTEGER, bathrooms INTEGER, area_m2 REAL,
    ac INTEGER DEFAULT 0, wifi INTEGER DEFAULT 0, parking INTEGER DEFAULT 0,
    furnished INTEGER DEFAULT 0, included_bill INTEGER DEFAULT 0,
    photos TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );
`);

// ===== UPLOAD FOTO =====
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '')),
  }),
  limits: { files: 6 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ message: 'Tidak terautentikasi' }); }
};

// ===== AUTH =====
app.post('/api/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Lengkapi data' });
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (exists) return res.status(400).json({ message: 'Email sudah terdaftar' });
  const info = db.prepare('INSERT INTO users(name,email,password,phone) VALUES(?,?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10), phone);
  res.json({ token: jwt.sign({ id: info.lastInsertRowid }, JWT_SECRET), name });
});

app.post('/api/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);
  if (!user || !bcrypt.compareSync(req.body.password, user.password))
    return res.status(401).json({ message: 'Email atau password salah' });
  res.json({ token: jwt.sign({ id: user.id }, JWT_SECRET), name: user.name });
});

// ===== UPLOAD PROPERTI =====
app.post('/api/properties', auth, upload.array('photos', 6), (req, res) => {
  const b = req.body;
  const s = v => (v === 'true' || v === true) ? 1 : 0;
  const info = db.prepare(`INSERT INTO properties
    (owner_id,title,type,price,address,city,description,lat,lng,
     bedrooms,bathrooms,area_m2,ac,wifi,parking,furnished,included_bill,photos)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.user.id, b.title, b.type, +b.price, b.address, b.city, b.description,
    +b.lat, +b.lng, +b.bedrooms, +b.bathrooms, +b.area_m2,
    s(b.ac), s(b.wifi), s(b.parking), s(b.furnished), s(b.included_bill),
    JSON.stringify((req.files || []).map(f => '/uploads/' + f.filename))
  );
  res.json({ id: info.lastInsertRowid, message: 'Properti berhasil diupload' });
});

// ===== CARI TERDEKAT =====
app.get('/api/nearby', (req, res) => {
  const { lat, lng, radius = 15, maxPrice, type, q } = req.query;
  let sql = `SELECT p.*, u.name AS owner_name, u.phone AS owner_phone
             FROM properties p JOIN users u ON p.owner_id=u.id
             WHERE (6371 * acos(
               cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?))
               + sin(radians(?)) * sin(radians(lat))
             )) <= ?`;
  const params = [lat, lng, lat, radius];
  if (maxPrice) { sql += ' AND price <= ?'; params.push(+maxPrice); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (q) { sql += ' AND (title LIKE ? OR city LIKE ? OR address LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY price ASC';
  res.json(db.prepare(sql).all(...params));
});

// ===== SEMUA & DETAIL =====
app.get('/api/properties', (req, res) =>
  res.json(db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all()));

app.get('/api/properties/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, u.name AS owner_name, u.phone AS owner_phone
    FROM properties p JOIN users u ON p.owner_id=u.id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ message: 'Tidak ditemukan' });
  res.json(p);
});

app.delete('/api/properties/:id', auth, (req, res) => {
  db.prepare('DELETE FROM properties WHERE id=? AND owner_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Dihapus' });
});

app.listen(PORT, () => console.log(`Server jalan di http://localhost:${PORT}`));
