# 🏠 Cari Kontrakan & Kosan

Aplikasi web pencari kontrakan & kosan berbasis lokasi terdekat (radius GPS).

## Fitur
- Login & registrasi (JWT)
- Upload properti: foto, harga, spesifikasi, pin lokasi di peta
- Pencarian properti terdekat berdasarkan lokasi pengguna
- Filter harga, tipe, dan kata kunci
- Peta interaktif (OpenStreetMap + Leaflet)

## Teknologi
Node.js + Express, SQLite (better-sqlite3), Leaflet.js

## Menjalankan Lokal
```bash
npm install
JWT_SECRET=string-acak npm start
# buka http://localhost:3000
```
