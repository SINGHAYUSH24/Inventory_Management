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
    const { status } = await request.json();

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Invalid status. Must be approved or rejected.' }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: 'Database connection missing.' }, { status: 500 });
    }

    const orders = await sql`
      SELECT id, status FROM orders WHERE id = ${Number(id)}
    `;

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const order = orders[0];
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `Order is already "${order.status}" and cannot be changed.` },
        { status: 400 }
      );
    }

    if (status === 'approved') {
      const items = await sql`
        SELECT oi.product_id, oi.ordered_quantity::float as ordered_quantity, 
               oi.conversion_factor::float as conversion_factor, p.name as product_name, 
               p.stock_quantity::float as stock_quantity
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${Number(id)}
      `;

      // Check stock availability for all items before modifying
      for (const item of items) {
        const qtyInBase = item.ordered_quantity * item.conversion_factor;
        if (qtyInBase > item.stock_quantity) {
          return NextResponse.json(
            { 
              error: `Insufficient stock for product "${item.product_name}". Available: ${item.stock_quantity}, Required: ${qtyInBase}` 
            }, 
            { status: 400 }
          );
        }
      }

      // Deduct stock for all items
      for (const item of items) {
        const qtyInBase = item.ordered_quantity * item.conversion_factor;
        await sql`
          UPDATE products 
          SET stock_quantity = stock_quantity - ${qtyInBase}
          WHERE id = ${item.product_id}
        `;
      }
    }

    // Update order status
    const result = await sql`
      UPDATE orders 
      SET status = ${status} 
      WHERE id = ${Number(id)} 
      RETURNING id, status
    `;

    return NextResponse.json({ success: true, order: result[0] });
  } catch (error: any) {
    console.error('Order status update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order status.' },
      { status: 500 }
    );
  }
}
