<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { supabase } from '$lib/supabase/client';
    import Card from '$lib/components/ui/card/card.svelte';
    import CardHeader from '$lib/components/ui/card/card-header.svelte';
    import CardTitle from '$lib/components/ui/card/card-title.svelte';
    import CardDescription from '$lib/components/ui/card/card-description.svelte';
    import CardContent from '$lib/components/ui/card/card-content.svelte';
    import Alert from '$lib/components/ui/alert/alert.svelte';
    import AlertTitle from '$lib/components/ui/alert/alert-title.svelte';
    import AlertDescription from '$lib/components/ui/alert/alert-description.svelte';
  
    let loading = true;
    let error = '';
  
    onMount(async () => {
      const token = $page.url.searchParams.get('token');
      const type = $page.url.searchParams.get('type');
  
      if (!token) {
        error = 'Token is missing in the URL.';
        loading = false;
        return;
      }
  
      try {
        let verificationError;
  
        if (type === 'invite') {
          // This is a user invitation flow
          const { error } = await supabase.auth.verifyOtp({
            token,
            type: 'invite',
          });
          verificationError = error;
        } else {
          // This is a standard signup confirmation
          const { error } = await supabase.auth.verifyOtp({
            token,
            type: 'signup',
          });
          verificationError = error;
        }
  
        if (verificationError) {
          console.error('Error in verification:', verificationError);
          error = 'There was an error confirming your email.';
        } else {
          goto(type === 'invite' ? '/auth/set-password?token=' + token : '/auth/login?confirmed=true');
        }
      } catch (err) {
        console.error('Error in confirmation process:', err);
        error = 'An unexpected error occurred.';
      } finally {
        loading = false;
      }
    });
  </script>
  
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <div class="text-center">
      <Card class="w-full max-w-md shadow-lg border-destructive/20">
        <CardHeader>
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-destructive">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </div>
          <CardTitle class="text-2xl text-center">Confirming Your Email</CardTitle>
          <CardDescription class="text-center">Please wait while we confirm your email address...</CardDescription>
        </CardHeader>
        <CardContent>
          {#if loading}
            <p>Loading...</p>
          {:else if error}
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          {:else}
            <p>Email confirmed successfully! Redirecting...</p>
          {/if}
        </CardContent>
      </Card>
    </div>
  </div>