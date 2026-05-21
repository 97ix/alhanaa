import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export interface SaleItem {
  id: number;
  sale_id: number;
  medicine_id: number;
  quantity: number;
  unit_price: number;
  purchase_price: number;
}

export async function getDb() {
  if (db) return db;
  console.log("Database.load starting...");
  try {
    db = await Database.load("sqlite:pharmacy.db");
    console.log("Database.load finished");
    return db;
  } catch (e) {
    console.error("Database.load error:", e);
    throw e;
  }
}

export async function closeDb() {
  if (db) {
    try {
      await db.close(db.path);
      db = null;
      console.log("Database connection closed");
    } catch (e) {
      console.error("Error closing database:", e);
    }
  }
}


export async function initDb() {
  try {
    console.log("Loading database...");
    const database = await getDb();
    console.log("Database loaded successfully");
    
    // Create tables if they don't exist
    await database.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category_id INTEGER,
        stock INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        barcode TEXT UNIQUE,
        expiry_date TEXT,
        tax_rate REAL, -- Individual tax rate override
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );
    `);

    // ... (rest of the create table statements)
    await database.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        balance REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        medicine_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales (id),
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      );
    `);
    await database.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        phone TEXT,
        email TEXT,
        balance REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS supplier_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS customer_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'payment', 'debt'
        amount REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS medicine_writeoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        batch_id INTEGER,
        quantity INTEGER NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id),
        FOREIGN KEY (batch_id) REFERENCES medicine_batches (id)
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tax_rate', '15')");
    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_name', 'صيدلية الهناء')");
    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_address', 'بغداد، العراق')");
    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('pharmacy_phone', '07701234567')");
    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_name', 'د. أنس ثورن')");
    await database.execute("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('user_role', 'صيدلي رئيسي')");

    // Migration: Add new columns to medicines if they don't exist
    try { await database.execute("ALTER TABLE medicines ADD COLUMN scientific_name TEXT"); } catch (e) {}
    try { await database.execute("ALTER TABLE medicines ADD COLUMN min_stock_level INTEGER DEFAULT 5"); } catch (e) {}
    try { await database.execute("ALTER TABLE medicines ADD COLUMN purchase_price REAL DEFAULT 0"); } catch (e) {}
    try { await database.execute("ALTER TABLE medicines ADD COLUMN tax_rate REAL"); } catch (e) {}

    // Migration: Add columns to sales
    try { await database.execute("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'"); } catch (e) {}
    try { await database.execute("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0"); } catch (e) {}
    try { await database.execute("ALTER TABLE sales ADD COLUMN tax_amount REAL DEFAULT 0"); } catch (e) {}
    try { await database.execute("ALTER TABLE sales ADD COLUMN customer_name TEXT"); } catch (e) {}
    try { await database.execute("ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0"); } catch (e) {}
    try { await database.execute("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0"); } catch (e) {}

    console.log("Tables checked/created");

    // Update sale_items to include purchase_price for better profit reporting
    const tableInfo = await database.select<any[]>("PRAGMA table_info(sale_items)");
    const hasPurchasePrice = tableInfo.some(col => col.name === 'purchase_price');
    if (!hasPurchasePrice) {
      await database.execute("ALTER TABLE sale_items ADD COLUMN purchase_price REAL DEFAULT 0");
      // Migration: fill existing sale_items with current medicine purchase price
      await database.execute(`
        UPDATE sale_items 
        SET purchase_price = (SELECT purchase_price FROM medicines WHERE medicines.id = sale_items.medicine_id)
      `);
    }

    // NEW MIGRATION: Medicine Batches System
    await database.execute(`
      CREATE TABLE IF NOT EXISTS medicine_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        expiry_date TEXT NOT NULL,
        purchase_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      );
    `);

    // Data Migration: Move current stock/expiry from medicines table to batches table IF NOT ALREADY DONE
    const countBatches = await database.select<any[]>("SELECT COUNT(*) as count FROM medicine_batches");
    if (countBatches[0].count === 0) {
      console.log("Migrating legacy stock to batches...");
      const legacyMedicines = await database.select<any[]>("SELECT id, stock, expiry_date, purchase_price FROM medicines WHERE stock > 0");
      for (const med of legacyMedicines) {
        await database.execute(
          "INSERT INTO medicine_batches (medicine_id, quantity, expiry_date, purchase_price) VALUES ($1, $2, $3, $4)",
          [med.id, med.stock, med.expiry_date, med.purchase_price]
        );
      }
    }

    // Batch-specific selling prices
    const batchInfo = await database.select<any[]>("PRAGMA table_info(medicine_batches)");
    const hasBatchSellingPrice = batchInfo.some(col => col.name === 'selling_price');
    if (!hasBatchSellingPrice) {
      await database.execute("ALTER TABLE medicine_batches ADD COLUMN selling_price REAL DEFAULT 0");
      // Migration: fill with current medicine price
      await database.execute(`
        UPDATE medicine_batches 
        SET selling_price = (SELECT price FROM medicines WHERE medicines.id = medicine_batches.medicine_id)
      `);
    }

    // Insert some default categories if empty
    const categories = await database.select("SELECT * FROM categories");
    if (Array.isArray(categories) && categories.length === 0) {
      await database.execute("INSERT INTO categories (name) VALUES ('Antibiotics'), ('Painkillers'), ('Vitamins'), ('First Aid'), ('General')");
    }

    console.log("Categories checked");
    return database;
  } catch (err) {
    console.error("Database Init Failed:", err);
    alert("فشل في تهيئة قاعدة البيانات: " + JSON.stringify(err));
    throw err;
  }
}
