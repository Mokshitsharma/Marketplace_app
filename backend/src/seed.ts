import { pathToFileURL } from 'node:url';
import { db, newId, now, tx } from './db.js';

// Demo data: fictional Indore stores. Store owners log in with their phone + OTP 1234.

const STORES = [
  { key: 'lakdi', name: 'Lakdi Ghar Furnishers', area: 'Rajwada', address: '14, Kaser Bazaar, Rajwada', lat: 22.7179, lng: 75.8561, category: 'furniture', phone: '9000000001' },
  { key: 'sajawat', name: 'Sajawat Home Decor', area: 'Palasia', address: '52, AB Road, New Palasia', lat: 22.7241, lng: 75.8847, category: 'furniture', phone: '9000000002' },
  { key: 'ghar', name: 'Ghar Ki Zaroorat', area: 'Vijay Nagar', address: 'Shop 7, Scheme 54, Vijay Nagar', lat: 22.7521, lng: 75.8929, category: 'home', phone: '9000000003' },
  { key: 'mehta', name: 'Mehta Hardware & Sanitary', area: 'Sapna Sangeeta', address: '3, Sapna Sangeeta Road', lat: 22.7018, lng: 75.8741, category: 'hardware', phone: '9000000004' },
  { key: 'bartan', name: 'Bartan Bhandar Sarafa', area: 'MG Road', address: '88, Sarafa Bazaar, near MG Road', lat: 22.7192, lng: 75.8708, category: 'home', phone: '9000000005' },
];

type P = [store: string, name: string, category: string, price: number, mrp: number | null, unit: string, stock: number, description: string];

const PRODUCTS: P[] = [
  ['lakdi', 'Sheesham wood plant stand', 'furniture', 1450, 1899, '3 tier', 6, 'Hand-finished sheesham stand for balcony pots. Folds flat.'],
  ['lakdi', 'Folding study table', 'furniture', 2199, 2799, '1 pc', 4, 'Engineered wood top with steel legs. 90 × 50 cm.'],
  ['lakdi', 'Mango wood bedside table', 'furniture', 3299, null, '1 pc', 2, 'One drawer, one open shelf. Natural finish.'],
  ['lakdi', 'Wooden shoe rack, 4 shelf', 'furniture', 1799, 2299, '1 pc', 5, 'Holds 12 pairs. Ventilated slats.'],
  ['lakdi', 'Cane moodha stool', 'furniture', 649, 799, '1 pc', 12, 'Classic cane and jute moodha, 16 inch.'],
  ['lakdi', 'Wall-mounted book shelf', 'furniture', 999, 1299, '1 pc', 0, 'Floating shelf, hardware included.'],
  ['sajawat', 'Brass diya set', 'furniture', 549, 699, 'set of 5', 20, 'Heavy brass diyas, polished by hand.'],
  ['sajawat', 'Jute floor rug', 'furniture', 1299, 1699, '4 × 6 ft', 7, 'Braided natural jute, anti-skid backing.'],
  ['sajawat', 'Maheshwari cushion covers', 'furniture', 699, 899, 'set of 2', 15, 'Handloom Maheshwari cotton-silk, 16 × 16 inch.'],
  ['sajawat', 'Ceramic table lamp', 'furniture', 1899, 2399, '1 pc', 3, 'Hand-glazed base with linen shade.'],
  ['sajawat', 'Wall clock, teak frame', 'furniture', 1199, null, '1 pc', 6, 'Silent sweep movement, 12 inch.'],
  ['sajawat', 'Terracotta planter pair', 'furniture', 449, 549, 'set of 2', 18, 'Made in Mandsaur. 8 inch with saucers.'],
  ['ghar', 'Steel clothes drying stand', 'home', 1599, 1999, '1 pc', 8, 'Foldable, rust-proof, holds a full load.'],
  ['ghar', 'Pressure cooker, 5 L', 'home', 1899, 2250, '1 pc', 9, 'Hard-anodised, induction friendly.'],
  ['ghar', 'Plastic storage drawers', 'home', 1349, 1599, '3 drawer', 6, 'Stackable unit on wheels.'],
  ['ghar', 'Cotton bedsheet, double', 'home', 799, 1099, '1 set', 14, 'Sanganeri print, with 2 pillow covers.'],
  ['ghar', 'Mosquito net, double bed', 'home', 499, 650, '1 pc', 11, 'Foldable, no-install frame.'],
  ['ghar', 'Iron board with stand', 'home', 1099, 1399, '1 pc', 5, 'Height adjustable, heat-proof rest.'],
  ['mehta', 'Cordless drill machine', 'hardware', 2799, 3499, '1 pc', 4, '12V, two batteries, 30-piece bit set.'],
  ['mehta', 'Screwdriver set', 'hardware', 399, 499, '10 pc', 25, 'Magnetic tips, flat and Phillips.'],
  ['mehta', 'Aluminium ladder, 5 step', 'hardware', 2499, 2999, '1 pc', 3, 'Folding ladder with top tray. 150 kg load.'],
  ['mehta', 'LED batten, 20 W', 'hardware', 299, 399, '1 pc', 40, 'Cool daylight, 4 ft.'],
  ['mehta', 'Tap with aerator', 'hardware', 649, 849, '1 pc', 10, 'Brass body, chrome finish, quarter turn.'],
  ['mehta', 'Extension board, 4 socket', 'hardware', 449, 599, '1 pc', 16, 'Surge protected, 2 m cable.'],
  ['bartan', 'Copper water bottle', 'home', 699, 899, '1 L', 18, 'Pure copper, leak-proof cap.'],
  ['bartan', 'Brass kadhai', 'home', 1649, 1999, '2 L', 5, 'Kalai-lined brass kadhai, made in Indore.'],
  ['bartan', 'Steel thali set', 'home', 1199, 1499, '6 pc', 9, 'Thali, katoris, glass and spoon.'],
  ['bartan', 'Cast iron tawa', 'home', 849, 999, '12 inch', 7, 'Pre-seasoned, for rotis and dosas.'],
  ['bartan', 'Masala dabba', 'home', 549, 699, '7 box', 12, 'Stainless steel with glass lid.'],
];

const DRIVERS = [
  ['Ravi Yadav', '9111000001', 'Bike · MP09 ZX 4412', 22.7201, 75.8601],
  ['Imran Khan', '9111000002', 'Bike · MP09 QA 1188', 22.7488, 75.8902],
  ['Sunil Patel', '9111000003', 'Tempo · MP09 GF 7730', 22.7052, 75.8715],
  ['Deepak Verma', '9111000004', 'Bike · MP09 LM 5520', 22.7263, 75.8812],
  ['Arjun Solanki', '9111000005', 'Tempo · MP09 HB 2204', 22.6951, 75.8488],
] as const;

export function seed() {
  tx(() => {
    for (const t of ['orders', 'addresses', 'customers', 'products', 'drivers', 'stores']) db.exec(`DELETE FROM ${t}`);

    const storeIds: Record<string, string> = {};
    for (const s of STORES) {
      const id = newId();
      storeIds[s.key] = id;
      db.prepare(
        `INSERT INTO stores (id, name, address, area, geo_lat, geo_lng, category, verified_status, owner_contact, bank_details, commission_rate, is_open)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, 0.1, 1)`,
      ).run(id, s.name, s.address, s.area, s.lat, s.lng, s.category, s.phone, 'HDFC ····4821');
    }

    PRODUCTS.forEach(([store, name, category, price, mrp, unit, stock, description], i) => {
      // Staggered created_at keeps a stable "newest first" ordering.
      const created = new Date(Date.now() - i * 60_000).toISOString();
      db.prepare(
        `INSERT INTO products (id, store_id, name, description, image_urls, price, mrp, unit, stock_qty, category, is_active, created_at)
         VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, 1, ?)`,
      ).run(newId(), storeIds[store], name, description, price, mrp, unit, stock, category, created);
    });

    for (const [name, phone, vehicle, lat, lng] of DRIVERS) {
      db.prepare('INSERT INTO drivers (id, name, phone, vehicle, geo_lat, geo_lng) VALUES (?, ?, ?, ?, ?, ?)').run(newId(), name, phone, vehicle, lat, lng);
    }

    const customerId = newId();
    db.prepare('INSERT INTO customers (id, name, phone) VALUES (?, ?, ?)').run(customerId, 'Demo Customer', '9876543210');
    db.prepare('INSERT INTO addresses (id, customer_id, label, line1, area, geo_lat, geo_lng) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      newId(), customerId, 'Home', '203, Shalimar Township', 'Scheme 54', 22.7575, 75.8971,
    );
  });
  console.log(`[seed] ${STORES.length} stores, ${PRODUCTS.length} products, ${DRIVERS.length} drivers, 1 demo customer (${now()})`);
}

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM stores').get() as { n: number };
  if (n === 0) seed();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--reset')) seed();
  else seedIfEmpty();
}
