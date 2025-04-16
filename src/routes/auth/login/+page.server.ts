// src/routes/auth/login/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  // Get redirect parameter or default to courses
  const redirectTo = url.searchParams.get('redirect') || '/courses';
  
  return {
    redirectTo
  };
};