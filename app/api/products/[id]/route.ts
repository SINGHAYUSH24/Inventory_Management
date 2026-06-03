import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role is required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
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

    // Check if sku exists in another product
    const existing = await sql`SELECT id FROM products WHERE sku = ${sku.trim()} AND id != ${Number(id)}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: `Another product with SKU "${sku}" already exists.` }, { status: 400 });
    }

    const result = await sql`
      UPDATE products 
      SET name = ${name.trim()}, 
          sku = ${sku.trim()}, 
          description = ${description?.trim() || ''}, 
          category = ${category?.trim() || ''}, 
          base_unit = ${base_unit}, 
          base_price = ${Number(base_price)}, 
          stock_quantity = ${Number(stock_quantity)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${Number(id)}
      RETURNING id, name, sku, description, category, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: result[0] });
  } catch (error: any) {
    console.error('Update product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update product.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role is required.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: 'Database connection missing.' }, { status: 500 });
    }

    const result = await sql`
      DELETE FROM products WHERE id = ${Number(id)} RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error: any) {
    console.error('Delete product error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete product.' },
      { status: 500 }
    );
  }
}
