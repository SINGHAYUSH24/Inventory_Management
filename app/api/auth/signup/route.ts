import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return NextResponse.json(
        { error: 'Name, email, password, and role are required.' },
        { status: 400 }
      );
    }

    if (role !== 'admin' && role !== 'seller') {
      return NextResponse.json(
        { error: 'Role must be admin or seller.' },
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

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save user
    const result = await sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${normalizedEmail}, ${passwordHash}, ${name.trim()}, ${role})
      RETURNING id, email, name, role
    `;

    const sessionUser = {
      id: result[0].id,
      email: result[0].email,
      name: result[0].name,
      role: result[0].role as 'admin' | 'seller',
    };

    // Log the user in directly
    await setAuthCookie(sessionUser);

    return NextResponse.json({ success: true, user: sessionUser });
  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during signup.' },
      { status: 500 }
    );
  }
}
