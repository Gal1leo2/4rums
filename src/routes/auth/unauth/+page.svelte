<!-- src/routes/auth/unauthorized/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
  
    let authUser = null;
    let countdown = 30;
    let reason = $page.url.searchParams.get('reason') || 'Your account requires approval';
    let redirectTo = $page.url.searchParams.get('redirect') || '/';
    let countdownActive = true;
  
    onMount(async () => {
      // Get current auth user information
      user.subscribe(u => {
        authUser = u;
      });
      
      // Start countdown for redirect
      const timer = setInterval(() => {
        if (countdownActive) {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            signOut();
          }
        }
      }, 1000);
      
      return () => clearInterval(timer);
    });
  
    async function signOut() {
      await supabase.auth.signOut();
      goto('/auth/login');
    }
  
    function goToRequestForm() {
      countdownActive = false; // Stop the countdown
      goto('/auth/request-access');
    }
  </script>
  
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md shadow-lg border-destructive/20">
      <CardHeader>
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-destructive">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </div>
        <CardTitle class="text-2xl text-center">Account Not Authorized</CardTitle>
        <CardDescription class="text-center">
          {reason}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Alert variant="destructive" class="mb-6">
          <AlertTitle>Unauthorized Access</AlertTitle>
          <AlertDescription>
            {#if authUser}
              <p>Your account with email <strong>{authUser.email}</strong> is not authorized to access this system.</p>
              <p class="mt-2">You need to request access and be approved by an administrator before you can use the system.</p>
            {:else}
              <p>You need to be properly registered in the system to access this content.</p>
            {/if}
          </AlertDescription>
        </Alert>
        
        <div class="text-center text-sm text-muted-foreground">
          <p>You will be signed out in <span class="font-medium">{countdown}</span> seconds</p>
          <p class="mt-1">Contact your administrator to request access to the system</p>
        </div>
      </CardContent>
      
      <CardFooter class="flex flex-col space-y-3">
        <Button variant="default" class="w-full" onclick={() => window.location.href = 'mailto:admin@example.com?subject=Access Request for ' + (authUser?.email || 'User')}>
          Contact Administrator
        </Button>
        <Button variant="outline" class="w-full" onclick={signOut}>
          Sign Out Now
        </Button>
      </CardFooter>
    </Card>
  </div>