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

    const units = await sql`
      SELECT id, name, unit_code, dimension, factor_to_base::float as factor_to_base
      FROM unit_conversions
      ORDER BY dimension, name
    `;

    return NextResponse.json({ units });
  } catch (error: any) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch units.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { name, unit_code, dimension, factor_to_base } = await request.json();

    if (!name?.trim() || !unit_code?.trim() || !dimension || factor_to_base === undefined) {
      return NextResponse.json(
        { error: 'All fields (name, unit_code, dimension, factor_to_base) are required.' },
        { status: 400 }
      );
    }

    if (dimension !== 'weight' && dimension !== 'volume' && dimension !== 'count') {
      return NextResponse.json(
        { error: 'Dimension must be weight, volume, or count.' },
        { status: 400 }
      );
    }

    const numericFactor = parseFloat(factor_to_base);
    if (isNaN(numericFactor) || numericFactor <= 0) {
      return NextResponse.json(
        { error: 'Conversion factor must be a positive number.' },
        { status: 400 }
      );
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json(
        { error: 'Database connection is not configured. Please set DATABASE_URL.' },
        { status: 500 }
      );
    }

    const code = unit_code.trim().toLowerCase();

    // Check if unit_code already exists
    const existing = await sql`SELECT id FROM unit_conversions WHERE unit_code = ${code}`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `A unit with the code "${code}" already exists.` },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO unit_conversions (name, unit_code, dimension, factor_to_base)
      VALUES (${name.trim()}, ${code}, ${dimension}, ${numericFactor})
      RETURNING id, name, unit_code, dimension, factor_to_base::float as factor_to_base
    `;

    return NextResponse.json({ success: true, unit: result[0] });
  } catch (error: any) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create unit.' },
      { status: 500 }
    );
  }
}
