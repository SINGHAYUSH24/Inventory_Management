import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const inStock = searchParams.get('inStock') === 'true';

    const sql = getSql();
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection is not configured. Please set DATABASE_URL.' },
        { status: 500 }
      );
    }

    let products;

    if (q && category) {
      products = await sql`
        SELECT id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity, created_at 
        FROM products 
        WHERE (name ILIKE ${'%' + q + '%'} OR sku ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'})
          AND category = ${category}
        ORDER BY name ASC
      `;
    } else if (q) {
      products = await sql`
        SELECT id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity, created_at 
        FROM products 
        WHERE (name ILIKE ${'%' + q + '%'} OR sku ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'})
        ORDER BY name ASC
      `;
    } else if (category) {
      products = await sql`
        SELECT id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity, created_at 
        FROM products 
        WHERE category = ${category}
        ORDER BY name ASC
      `;
    } else {
      products = await sql`
        SELECT id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity, created_at 
        FROM products 
        ORDER BY name ASC
      `;
    }

    if (inStock) {
      products = products.filter(p => p.stock_quantity > 0);
    }

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Fetch products error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role is required.' },
        { status: 403 }
      );
    }

    const { name, sku, description, category, base_unit, base_price, stock_quantity } = await request.json();

    if (!name?.trim() || !sku?.trim() || !base_unit) {
      return NextResponse.json({ error: 'Name, SKU, and Base Unit are required.' }, { status: 400 });
    }

    if (base_price === undefined || isNaN(Number(base_price)) || Number(base_price) < 0) {
      return NextResponse.json({ error: 'Base Price must be a positive number.' }, { status: 400 });
    }

    if (stock_quantity === undefined || isNaN(Number(stock_quantity)) || Number(stock_quantity) < 0) {
      return NextResponse.json({ error: 'Stock Quantity must be a positive number.' }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: 'Database connection missing.' }, { status: 500 });
    }

    // Check if sku exists
    const existing = await sql`SELECT id FROM products WHERE sku = ${sku.trim()}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: `Product with SKU "${sku}" already exists.` }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO products (name, sku, description, category, base_unit, base_price, stock_quantity)
      VALUES (${name.trim()}, ${sku.trim()}, ${description?.trim() || ''}, ${category?.trim() || ''}, ${base_unit}, ${Number(base_price)}, ${Number(stock_quantity)})
      RETURNING id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity
    `;

    return NextResponse.json({ success: true, product: result[0] });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product.' },
      { status: 500 }
    );
  }
}
