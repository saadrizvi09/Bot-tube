import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    console.log('Login request received');
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };
    
    console.log('Login attempt for email:', email);
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { emailAddress: email } });
    if (!user) {
      console.log('User not found:', email);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log('User found, verifying password...');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      console.log('Password verification failed for:', email);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log('Password verified successfully for:', email);
    const token = signToken({ userId: user.id });
    console.log('Token created successfully');

    const res = NextResponse.json({ user: { id: user.id, emailAddress: user.emailAddress, firstName: user.firstName, lastName: user.lastName } });
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    
    console.log('Login completed successfully');
    return res;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err?.message || 'Login failed' }, { status: 500 });
  }
}



