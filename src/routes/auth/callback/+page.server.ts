// src/routes/auth/callback/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const redirectTo = url.searchParams.get('redirectTo') || '/courses';
  
  if (code) {
    // Pass the redirectTo parameter to the client
    return { redirectTo };
  }
  
  // If no code is present, redirect to login
  throw redirect(303, '/auth/login');
};