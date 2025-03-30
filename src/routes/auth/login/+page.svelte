<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { supabase } from "$lib/supabase/client";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Label } from "$lib/components/ui/label";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
  
    let email = '';
    let password = '';
    let loading = false;
    let error = '';
  
    // Get redirect URL from query params
    const redirectTo = $page.url.searchParams.get('redirect') || '/courses';
  
    async function handleLogin() {
      loading = true;
      error = '';
      
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (err) {
        error = err.message;
        loading = false;
        return;
      }
      
      goto(redirectTo);
    }
  </script>
  
  <div class="flex min-h-screen items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-2xl">Sign In</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {#if error}
          <Alert variant="destructive" class="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        {/if}
        
        <form on:submit|preventDefault={handleLogin} class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={email} placeholder="name@example.com" required />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" type="password" bind:value={password} required />
          </div>
          
          <Button type="submit" class="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
      <CardFooter class="flex justify-center">
        <p class="text-sm text-center text-muted-foreground">
          Don't have an account? <a href="/auth/register" class="underline">Register</a>
        </p>
      </CardFooter>
    </Card>
  </div>