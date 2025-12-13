import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES_BASE = [
  '/', '/sign-in', '/sign-up',
  '/api/auth/register', '/api/auth/login', '/api/auth/logout',
  '/api/test-db', // For debugging database connection
  '/api/auth/verify-token', // Allow this new route
];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow access to auth API routes and test routes regardless of token presence
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/test-db')) {
    return NextResponse.next();
  }

  let isAuthenticated = false;
  const cookieToken = req.cookies.get('token')?.value;

  // Only attempt to verify token if one exists
  if (cookieToken) {
    try {
      // Call an internal API route to verify the token in a Node.js runtime
      const verifyRes = await fetch(new URL('/api/auth/verify-token', req.nextUrl.origin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cookieToken}`,
        },
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (data.authenticated) {
          isAuthenticated = true;
        }
      } else {
        console.log('Proxy: Token verification API returned non-OK status:', verifyRes.status);
      }
    } catch (error) {
      console.error('Proxy: Error calling token verification API:', error);
    }
  }

  let publicRoutes = [...PUBLIC_ROUTES_BASE];

  // If the user is authenticated, the dashboard and new video pages become public for them
  if (isAuthenticated) {
    publicRoutes.push('/dashboard', '/videos/new');
  }

  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  // Debugging logs
  console.log(`Proxy: Path ${pathname}, Authenticated: ${isAuthenticated}, IsPublic: ${isPublic}`);

  if (isPublic) {
    console.log(`Proxy: Path ${pathname} is public, allowing access.`);
    return NextResponse.next();
  }

  // If not public and not authenticated, redirect to sign-in
  if (!isAuthenticated) {
    console.log(`Proxy: Redirecting unauthenticated user from ${pathname} to /sign-in`);
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(url);
  }

  console.log(`Proxy: Authenticated user accessing protected path ${pathname}, allowing access.`);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
