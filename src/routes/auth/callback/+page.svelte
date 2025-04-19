<!-- src/routes/auth/callback/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase/client';
	import { goto } from '$app/navigation';

	let message = 'Completing sign in...';
	let loading = true;

	onMount(async () => {
		const redirectTo = $page.url.searchParams.get('redirectTo') || '/courses';
		
		// Check for error in URL hash (Supabase puts errors in the hash fragment)
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const hashError = hashParams.get('error');
		const hashErrorDescription = hashParams.get('error_description');
		
		if (hashError) {
			// For hash errors, redirect to login with error info
			const errorMessage = hashErrorDescription?.replace(/\+/g, ' ') || 'Authentication failed';
			window.location.href = `/auth/login?error=${encodeURIComponent(errorMessage)}`;
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
	<div class="text-center">
		<h2 class="mb-2 text-xl font-medium">{message}</h2>
		<p class="text-muted-foreground">Please wait while we process your sign in.</p>
		{#if loading}
			<div class="mt-4 flex justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
			</div>
		{/if}
	</div>
</div>