<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase/client';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';

	let message = 'Completing sign in...';
	let loading = true;
	let error = '';
	let errorDescription = '';

	onMount(async () => {
		const redirectTo = $page.url.searchParams.get('redirectTo') || '/courses';
		
		// Check for error in URL hash (Supabase puts errors in the hash fragment)
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const hashError = hashParams.get('error');
		const hashErrorDescription = hashParams.get('error_description');
		
		if (hashError) {
			// Handle error from hash
			error = hashError.replace(/_/g, ' ');
			errorDescription = hashErrorDescription?.replace(/\+/g, ' ') || 'Authentication failed';
			loading = false;
			return;
		}

		// Give Supabase a moment to process authentication
		setTimeout(async () => {
			try {
				// Check if user has a session
				const { data: sessionData } = await supabase.auth.getSession();

				if (sessionData?.session) {
					// User is authenticated with Supabase, now check if they exist in the users table
					const { data: userData, error: userError } = await supabase
						.from('users')
						.select('id')
						.eq('id', sessionData.session.user.id)
						.maybeSingle();

					if (userError) {
						console.error('Error checking user record:', userError);
					}

					// If user doesn't exist in the database, redirect to unauthorized page
					if (!userData) {
						console.log('User authenticated but not in database, redirecting to unauthorized');
						window.location.href = '/auth/unauth?reason=User+not+found+in+database';
						return;
					}

					// User is fully authorized, redirect to the requested page
					window.location.href = redirectTo;
				} else {
					// No session found, redirect to login
					message = 'Authentication failed. Redirecting to login...';
					setTimeout(() => {
						window.location.href = '/auth/login?error=No+session+found';
					}, 1000);
				}
			} catch (error) {
				console.error('Error in auth callback:', error);
				message = 'An error occurred. Redirecting to login...';
				setTimeout(() => {
					window.location.href = '/auth/login?error=Authentication+error';
				}, 1000);
			} finally {
				loading = false;
			}
		}, 500); // Short delay to let Supabase process the auth
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-md p-4 text-center">
		{#if error}
			<div class="mb-8">
				<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				</div>
				
				<Alert variant="destructive" class="mb-6">
					<AlertTitle class="capitalize">{error}</AlertTitle>
					<AlertDescription>{errorDescription}</AlertDescription>
				</Alert>
				
				<p class="mb-6 text-muted-foreground">Please try signing in again with a valid link or use your password to sign in.</p>
				
				<Button href="/auth/login" variant="default">Go to Login</Button>
			</div>
		{:else}
			<h2 class="mb-2 text-xl font-medium">{message}</h2>
			<p class="text-muted-foreground">Please wait while we process your sign in.</p>
			{#if loading}
				<div class="mt-4 flex justify-center">
					<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
				</div>
			{/if}
		{/if}
	</div>
</div>