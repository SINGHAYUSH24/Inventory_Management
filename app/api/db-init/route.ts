import { NextResponse } from 'next/server';
import { initializeDatabase, checkDatabaseConnection } from '@/lib/db';

export async function POST() {
  try {
    const isConnected = await checkDatabaseConnection();
    if (!isConnected && !process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL environment variable is missing. Please set it in your .env.local file.' },
        { status: 400 }
      );
    }
    await initializeDatabase();
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized and seeded successfully.' 
    });
  } catch (error: any) {
    console.error('Failed to initialize database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize database. Check terminal logs.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Let the user know the status
  const isConnected = await checkDatabaseConnection();
  return NextResponse.json({
    connected: isConnected,
    hasUrl: !!process.env.DATABASE_URL,
  });
}
