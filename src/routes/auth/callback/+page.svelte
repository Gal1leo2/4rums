<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';

  onMount(async () => {
    // Get redirect URL from query params
    const queryParams = new URLSearchParams(window.location.search);
    const redirectTo = queryParams.get('redirectTo') || '/courses';

    console.log("Auth callback running, checking session...");
    
    try {
      // Process the OAuth callback
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error completing sign in:', error);
        goto('/auth/login?error=Authentication%20failed');
        return;
      }
      
      if (data.session) {
        console.log("Session found, checking if user exists in database...");
        
        // Extract user details from the session
        const authUser = data.session.user;
        
        // Check if user exists in the users table
        const { data: existingUser, error: userError } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', authUser.id)
          .single();
        
        if (userError) {
          console.log("User does not exist in database, redirecting to unauthorized page");
          // Store auth user in the store so we can display their email
          user.set(authUser);
          goto('/auth/unauthorized?redirect=' + encodeURIComponent(redirectTo));
          return;
        }
        
        // User exists, update the store and redirect
        user.set({
          ...authUser,
          db_role: existingUser.role
        });
        
        console.log("User found in database, redirecting to:", redirectTo);
        goto(redirectTo);
      } else {
        // If there's a hash with access_token, we need to handle it
        if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log("Found access token in URL, setting session...");
          
          try {
            // Let Supabase process the hash
            const { data, error } = await supabase.auth.getSessionFromUrl();
            
            if (error) {
              console.error('Error processing token from URL:', error);
              goto('/auth/login?error=Token%20processing%20failed');
              return;
            }
            
            if (data?.session) {
              const authUser = data.session.user;
              
              // Check if user exists in the users table
              const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('id, role')
                .eq('id', authUser.id)
                .single();
              
              if (userError) {
                console.log("User does not exist in database, redirecting to unauthorized page");
                // Store auth user in the store so we can display their email
                user.set(authUser);
                goto('/auth/unauthorized?redirect=' + encodeURIComponent(redirectTo));
                return;
              }
              
              // User exists, update the store and redirect
              user.set({
                ...authUser,
                db_role: existingUser.role
              });
              
              console.log("User found in database, redirecting to:", redirectTo);
              goto(redirectTo);
            } else {
              console.error('No session created from token');
              goto('/auth/login?error=No%20session%20created');
            }
          } catch (tokenError) {
            console.error('Error processing token:', tokenError);
            goto('/auth/login?error=Token%20processing%20error');
          }
        } else {
          console.error('No session found and no token in URL');
          goto('/auth/login?error=No%20session%20or%20token');
        }
      }
    } catch (error) {
      console.error('Error in auth callback:', error);
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