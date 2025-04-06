<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';

  onMount(async () => {
    // Get the URL hash and parameters
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(window.location.search);
    const redirectTo = queryParams.get('redirectTo') || '/courses';

    console.log("Auth callback running, checking session...");
    
    // Process the OAuth callback
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error completing sign in:', error);
      goto('/auth/login?error=Authentication%20failed');
      return;
    }
    
    if (data.session) {
      console.log("Session found, redirecting to:", redirectTo);
      
      // Set a short timeout to ensure auth state updates
      setTimeout(() => {
        goto(redirectTo);
      }, 300);
    } else {
      // If there's a hash with access_token, we need to handle it
      if (hash && hash.includes('access_token')) {
        console.log("Found access token in URL, setting session...");
        
        // Let Supabase process the hash
        const { data, error } = await supabase.auth.getSessionFromUrl();
        
        if (error) {
          console.error('Error processing token from URL:', error);
          goto('/auth/login?error=Token%20processing%20failed');
          return;
        }
        
        if (data?.session) {
          // Update user store
          user.set(data.session.user);
          
          console.log("Session created from URL token, redirecting to:", redirectTo);
          goto(redirectTo);
        } else {
          console.error('No session created from token');
          goto('/auth/login?error=No%20session%20created');
        }
      } else {
        console.error('No session found and no token in URL');
        goto('/auth/login?error=No%20session%20or%20token');
      }
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