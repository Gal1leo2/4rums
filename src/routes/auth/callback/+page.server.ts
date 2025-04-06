// src/routes/auth/callback/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const redirectTo = url.searchParams.get('redirectTo') || '/courses';
  
  if (code) {
    // The rest of the OAuth flow is handled on the client
    // This page just ensures we pass along the redirectTo parameter
    return { redirectTo };
  }
  
  // If no code is present, redirect to login
  throw redirect(303, '/auth/login');
};