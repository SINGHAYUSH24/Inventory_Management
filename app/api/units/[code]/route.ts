import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

const DEFAULT_UNITS = ['g', 'kg', 'mL', 'L', 'items'];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { code } = await params;
    const normalizedCode = code.trim().toLowerCase();

    if (DEFAULT_UNITS.includes(normalizedCode)) {
      return NextResponse.json(
        { error: 'Default base units are protected and cannot be modified.' },
        { status: 400 }
      );
    }

    const { name, factor_to_base } = await request.json();

    if (!name?.trim() || factor_to_base === undefined) {
      return NextResponse.json(
        { error: 'Fields "name" and "factor_to_base" are required.' },
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

    const result = await sql`
      UPDATE unit_conversions
      SET name = ${name.trim()}, factor_to_base = ${numericFactor}
      WHERE unit_code = ${normalizedCode}
      RETURNING id, name, unit_code, dimension, factor_to_base::float as factor_to_base
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Unit conversion not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, unit: result[0] });
  } catch (error: any) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update unit conversion.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const { code } = await params;
    const normalizedCode = code.trim().toLowerCase();

    if (DEFAULT_UNITS.includes(normalizedCode)) {
      return NextResponse.json(
        { error: 'Default base units are protected and cannot be deleted.' },
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

    // Check if any product is using this unit as base_unit
    const activeProducts = await sql`
      SELECT id FROM products WHERE base_unit = ${normalizedCode}
    `;
    if (activeProducts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete unit because it is currently used as a base unit for catalog products.' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM unit_conversions
      WHERE unit_code = ${normalizedCode}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Unit conversion not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting unit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete unit conversion.' },
      { status: 500 }
    );
  }
}
