import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;
if(!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}
const key = new TextEncoder().encode(JWT_SECRET);

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'seller';
}

export async function signJWT(payload: any): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

export async function verifyJWT(token: string): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload) return null;

  return {
    id: payload.id as number,
    email: payload.email as string,
    name: payload.name as string,
    role: payload.role as 'admin' | 'seller',
  };
}

export async function setAuthCookie(user: SessionUser) {
  const token = await signJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1,
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}
