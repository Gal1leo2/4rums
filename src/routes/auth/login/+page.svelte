<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { signInWithEmail, signInWithGoogle } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { Separator } from '$lib/components/ui/separator';

	// Export page data properties
	export let data;

	let email = '';
	let password = '';
	let loading = false;
	let googleLoading = false;
	let error = '';
	let showPassword = false;

	// Get redirect URL from data or default to courses
	const redirectTo = browser
		? new URLSearchParams(window.location.search).get('redirect') || data.redirectTo || '/courses'
		: '/courses';

	// Initialize with error parameter if present
	onMount(() => {
		if (browser) {
			const urlError = new URLSearchParams(window.location.search).get('error');
			if (urlError) {
				error = decodeURIComponent(urlError);
			}
		}
	});

	async function handleLogin() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';

		const result = await signInWithEmail(email, password);

		if (!result.success) {
			error = result.error || 'Login failed';
			loading = false;
			return;
		}

		goto(redirectTo);
	}

	async function handleGoogleLogin() {
		googleLoading = true;
		error = '';

		// Store redirect in localStorage for backup
		if (browser) {
			try {
				localStorage.setItem('auth_redirect', redirectTo);
			} catch (e) {
				console.error('Failed to save redirect to localStorage:', e);
			}
		}

		const result = await signInWithGoogle(redirectTo);

		if (!result.success) {
			error = result.error || 'Google login failed';
			googleLoading = false;
		}
		// No need to redirect here - OAuth flow will handle it
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted/30 px-4 py-12">
	<div class="w-full max-w-md">
		<Card class="border-muted/50 shadow-xl backdrop-blur-sm">
			<CardHeader class="space-y-3 pb-6">
				<div class="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-inner">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="28"
						height="28"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-primary"
					>
						<path d="M19 10h2l-8-8-8 8h2v10h12z"></path>
						<path d="M12 16v-6"></path>
					</svg>
				</div>
				<CardTitle class="text-center text-3xl font-bold">Welcome Back</CardTitle>
				<CardDescription class="text-center text-base">
					Enter your credentials to access your account
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-6">
				{#if error}
					<Alert variant="destructive" class="mb-4 border-red-200 bg-red-50/50 text-red-800">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="mr-2 h-4 w-4"
						>
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="12" y1="8" x2="12" y2="12"></line>
							<line x1="12" y1="16" x2="12.01" y2="16"></line>
						</svg>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				{/if}

				<!-- Google Sign In Button -->
				<Button
					variant="outline"
					class="relative w-full overflow-hidden border border-gray-200 bg-white py-6 text-black shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
					onclick={handleGoogleLogin}
					disabled={googleLoading}
				>
					{#if googleLoading}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="mr-2 h-5 w-5 animate-spin"
						>
							<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
						</svg>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							xmlns="http://www.w3.org/2000/svg"
							class="mr-2"
						>
							<g transform="matrix(1, 0, 0, 1, 0, 0)">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</g>
						</svg>
					{/if}
					<span class="font-medium">Sign in with Google</span>
				</Button>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<Separator class="bg-muted/70" />
					</div>
					<div class="relative flex justify-center">
						<span class="bg-background px-4 text-sm font-medium text-muted-foreground">OR</span>
					</div>
				</div>

				<form on:submit|preventDefault={handleLogin} class="space-y-5">
					<div class="space-y-2">
						<Label for="email" class="flex items-center gap-2 font-medium text-sm ml-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4 text-muted-foreground"
							>
								<rect x="2" y="4" width="20" height="16" rx="2"></rect>
								<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
							</svg>
							Email
						</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="name@example.com"
							autocomplete="email"
							required
							class="py-6 px-4 bg-muted/10 focus:bg-white transition-colors"
						/>
					</div>
					<div class="space-y-2">
						<Label for="password" class="flex items-center gap-2 font-medium text-sm ml-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4 text-muted-foreground"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
								<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
							</svg>
							Password
						</Label>
						<div class="relative">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								autocomplete="current-password"
								required
								class="py-6 px-4 bg-muted/10 focus:bg-white transition-colors"
							/>
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
								on:click={togglePasswordVisibility}
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
						<div class="flex justify-end">
							<a
								href="/auth/reset-password"
								class="text-sm text-primary font-medium hover:text-primary/80 hover:underline"
							>
								Forgot password?
							</a>
						</div>
					</div>

					<Button type="submit" class="w-full py-6 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/20 transition-all" disabled={loading}>
						{#if loading}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="mr-2 h-5 w-5 animate-spin"
							>
								<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
							</svg>
							<span class="font-medium">Signing in...</span>
						{:else}
							<span class="font-medium">Sign in with Email</span>
						{/if}
					</Button>
				</form>
			</CardContent>
		</Card>
	</div>
</div>