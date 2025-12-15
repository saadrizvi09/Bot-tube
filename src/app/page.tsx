import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import LandingClient from '@/components/LandingClient'; // Import the new component

export default async function LandingPage() {
  const token = (await cookies()).get('token')?.value;
  const payload = token ? verifyToken(token) : null;
  const isAuthenticated = !!payload?.userId;

  return <LandingClient isAuthenticated={isAuthenticated} />;
}