import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection is not configured. Please set DATABASE_URL.' },
        { status: 500 }
      );
    }

    let orders;
    if (user.role === 'admin') {
      orders = await sql`
        SELECT o.id, o.status, o.total_price::float as total_price, o.created_at, u.name as user_name, u.email as user_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `;
    } else {
      orders = await sql`
        SELECT o.id, o.status, o.total_price::float as total_price, o.created_at
        FROM orders o
        WHERE o.user_id = ${user.id}
        ORDER BY o.created_at DESC
      `;
    }

    // Retrieve order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const items = await sql`
          SELECT oi.id, oi.ordered_quantity::float as ordered_quantity, oi.ordered_unit, 
                 oi.base_unit, oi.base_price::float as base_price, oi.conversion_factor::float as conversion_factor, 
                 oi.calculated_price::float as calculated_price, p.name as product_name, p.sku as product_sku
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${order.id}
        `;
        return {
          ...order,
          items,
        };
      })
    );

    return NextResponse.json({ success: true, orders: ordersWithItems });
  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { items } = await request.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item.' }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: 'Database connection missing.' }, { status: 500 });
    }

    // Load dynamic units mapping from database
    const dbUnits = await sql`
      SELECT unit_code, dimension, factor_to_base::float as factor_to_base
      FROM unit_conversions
    `;
    const unitsMap: Record<string, { dimension: string; factorToBase: number }> = {};
    dbUnits.forEach(u => {
      unitsMap[u.unit_code] = {
        dimension: u.dimension,
        factorToBase: u.factor_to_base
      };
    });

    let totalPrice = 0;
    const validatedItems = [];

    // First pass: Validate products and calculate conversions
    for (const item of items) {
      const { productId, orderedQuantity, orderedUnit } = item;
      const parsedQty = parseFloat(orderedQuantity);

      if (!productId || isNaN(parsedQty) || parsedQty <= 0 || !orderedUnit) {
        return NextResponse.json({ error: 'Invalid product, quantity, or unit in items.' }, { status: 400 });
      }

      const products = await sql`
        SELECT id, name, sku, base_unit, base_price::float as base_price, stock_quantity::float as stock_quantity 
        FROM products 
        WHERE id = ${Number(productId)}
      `;

      if (products.length === 0) {
        return NextResponse.json({ error: `Product ID ${productId} not found.` }, { status: 404 });
      }

      const product = products[0];

      const fromInfo = unitsMap[orderedUnit];
      const toInfo = unitsMap[product.base_unit];

      if (!fromInfo || !toInfo) {
        return NextResponse.json(
          { error: `Unsupported units: "${orderedUnit}" or "${product.base_unit}" for product "${product.name}".` },
          { status: 400 }
        );
      }

      if (fromInfo.dimension !== toInfo.dimension) {
        return NextResponse.json(
          { error: `Incompatible units for product "${product.name}": Cannot convert from ${orderedUnit} (${fromInfo.dimension}) to ${product.base_unit} (${toInfo.dimension})` },
          { status: 400 }
        );
      }

      const conversionFactor = fromInfo.factorToBase / toInfo.factorToBase;
      const qtyInBase = parsedQty * conversionFactor;
      const calculatedPrice = qtyInBase * product.base_price;

      totalPrice += calculatedPrice;

      validatedItems.push({
        product_id: product.id,
        ordered_quantity: parsedQty,
        ordered_unit: orderedUnit,
        base_unit: product.base_unit,
        base_price: product.base_price,
        conversion_factor: conversionFactor,
        calculated_price: calculatedPrice,
      });
    }

    // Insert order header
    const orderResult = await sql`
      INSERT INTO orders (user_id, status, total_price)
      VALUES (${user.id}, 'pending', ${totalPrice})
      RETURNING id, status, total_price::float as total_price, created_at
    `;
    const orderId = orderResult[0].id;

    // Insert order items
    for (const validatedItem of validatedItems) {
      await sql`
        INSERT INTO order_items (order_id, product_id, ordered_quantity, ordered_unit, base_unit, base_price, conversion_factor, calculated_price)
        VALUES (
          ${orderId}, 
          ${validatedItem.product_id}, 
          ${validatedItem.ordered_quantity}, 
          ${validatedItem.ordered_unit}, 
          ${validatedItem.base_unit}, 
          ${validatedItem.base_price}, 
          ${validatedItem.conversion_factor}, 
          ${validatedItem.calculated_price}
        )
      `;
    }

    return NextResponse.json({
      success: true,
      order: {
        ...orderResult[0],
        items: validatedItems,
      },
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to place order/quotation.' },
      { status: 500 }
    );
  }
}

