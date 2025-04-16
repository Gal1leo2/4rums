// src/routes/auth/callback/+page.server.ts
import type { PageServerLoad } from './$types';

// Simple pass-through to make sure the page loads
export const load: PageServerLoad = async ({ url }) => {
  const redirectTo = url.searchParams.get('redirectTo') || '/courses';
  
  return { 
    redirectTo,
    // Pass any other URL parameters that might be needed
    params: Object.fromEntries(url.searchParams.entries())
  };
};