import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  return neon(url);
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export async function initializeDatabase() {
  const sql = getSql();
  if (!sql) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Create tables in sequence or in a multi-statement query
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(100),
      base_unit VARCHAR(10) NOT NULL,
      base_price NUMERIC(20, 4) NOT NULL,
      stock_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0.0000,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      total_price NUMERIC(20, 4) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      ordered_quantity NUMERIC(20, 4) NOT NULL,
      ordered_unit VARCHAR(10) NOT NULL,
      base_unit VARCHAR(10) NOT NULL,
      base_price NUMERIC(20, 4) NOT NULL,
      conversion_factor NUMERIC(20, 8) NOT NULL,
      calculated_price NUMERIC(20, 4) NOT NULL
    );
  `;

  // Seed default admin and seller if they don't exist
  const existingUsers = await sql`SELECT COUNT(*)::int as count FROM users`;
  if (existingUsers[0].count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const sellerHash = await bcrypt.hash('seller123', 10);

    await sql`
      INSERT INTO users (email, password_hash, name, role) VALUES 
      ('admin@inventory.com', ${adminHash}, 'System Administrator', 'admin'),
      ('seller@inventory.com', ${sellerHash}, 'Sales Representative', 'seller')
    `;
    console.log('Seeded users.');
  }

  // Seed default products if they don't exist
  const existingProducts = await sql`SELECT COUNT(*)::int as count FROM products`;
  if (existingProducts[0].count === 0) {
    await sql`
      INSERT INTO products (name, sku, description, category, base_unit, base_price, stock_quantity) VALUES
      ('Organic Basmati Rice', 'RICE-BAS-01', 'Premium long grain organic basmati rice', 'Grains', 'kg', 120.0000, 250.0000),
      ('Pure Olive Oil', 'OIL-OLV-02', 'Extra virgin cold-pressed olive oil', 'Liquids', 'L', 850.0000, 50.0000),
      ('Himalayan Pink Salt', 'SALT-PNK-03', 'Fine ground pink salt from the Himalayas', 'Spices', 'g', 0.2500, 10000.0000),
      ('Fresh Whole Milk', 'MILK-WHL-04', 'Pasteurized full cream whole milk', 'Dairy', 'mL', 0.0700, 20000.0000),
      ('Stainless Steel Spoons', 'UTN-SPN-05', 'High quality rust-proof tea spoons', 'Cutlery', 'items', 45.0000, 150.0000)
    `;
    console.log('Seeded products.');
  }
}
