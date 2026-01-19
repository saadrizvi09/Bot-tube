import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Please add it to your .env file.');
}

export type JwtPayload = {
  userId: string;
};

export function signToken(payload: JwtPayload, options?: jwt.SignOptions): string {
  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: '7d',
    ...options,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
    return decoded;
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, passwordHash);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.substring('Bearer '.length);
  }
  const token = req.cookies.get('token')?.value;
  return token ?? null;
}

export function getUserFromRequest(req: NextRequest): { userId: string } | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId };
}

export function setAuthCookie(response: Response, token: string) {
}

export async function getUserFromCookies(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get('token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId };
}


