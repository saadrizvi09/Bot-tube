import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    console.log('Registration request received');
    const body = await req.json();
    const { email, password, firstName = '', lastName = '' } = body as {
      email: string; password: string; firstName?: string; lastName?: string;
    };

    console.log('Registration data:', { email, firstName, lastName });

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { emailAddress: email } });
    if (existing) {
      console.log('User already exists:', email);
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }

    console.log('Hashing password...');
    const passwordHash = await hashPassword(password);
    console.log('Password hashed successfully');

    const userId = randomUUID();
    console.log('Creating user with ID:', userId);

    const user = await db.user.create({
      data: {
        id: userId,
        emailAddress: email,
        passwordHash,
        firstName,
        lastName: lastName || null,
      },
      select: { id: true, emailAddress: true, firstName: true, lastName: true },
    });

    console.log('User created successfully:', user.emailAddress);

    const token = signToken({ userId: user.id });
    console.log('Token created successfully');

    const res = NextResponse.json({ user });
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    
    console.log('Registration completed successfully');
    return res;
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: err?.message || 'Registration failed' }, { status: 500 });
  }
}


