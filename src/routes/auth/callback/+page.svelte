<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase/client';

  onMount(async () => {
    // Get redirect URL from query params or default to courses
    const redirectTo = $page.url.searchParams.get('redirectTo') || '/courses';

    try {
      // Exchange the auth code for a session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error in auth callback:', error);
        goto('/auth/login?error=Authentication%20failed');
        return;
      }
      
      if (!data.session) {
        // If no session yet, try to get it from URL (OAuth callback)
        const { error: urlError } = await supabase.auth.getSessionFromUrl();
        
        if (urlError) {
          console.error('Error getting session from URL:', urlError);
          goto('/auth/login?error=Authentication%20failed');
          return;
        }
      }
      
      // At this point auth state change listeners will update the app
      // Just redirect to the destination
      goto(redirectTo);
    } catch (error) {
      console.error('Exception in auth callback:', error);
      goto('/auth/login?error=Authentication%20error');
    }
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="text-center">
    <h2 class="text-xl font-medium mb-2">Completing sign in...</h2>
    <p class="text-muted-foreground">Please wait while we redirect you.</p>
    <div class="mt-4 flex justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  </div>
</div>