<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { supabase } from '$lib/supabase/client';
  
    onMount(async () => {
      // Get the URL hash and parameters
      const hash = window.location.hash;
      const queryParams = new URLSearchParams(window.location.search);
      const redirectTo = queryParams.get('redirectTo') || '/courses';
  
      // Process the OAuth callback
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error completing sign in:', error);
        goto('/auth/login?error=Authentication%20failed');
        return;
      }
      
      // Redirect to the desired page after successful login
      goto(redirectTo);
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