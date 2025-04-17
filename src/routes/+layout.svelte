<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import 'highlight.js/styles/github-dark.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { initAuth, user } from '$lib/stores/auth';
    import { goto, afterNavigate, beforeNavigate } from '$app/navigation';


	let { children } = $props();
	let currentPath = '';

	onMount(() => {
		console.log('Layout mounted, initializing auth');

		// Initialize authentication
		const cleanup = initAuth();

		// Store initial path
		currentPath = window.location.pathname;
		injectAnalytics({ mode: dev ? 'development' : 'production' });

		// Return a synchronous cleanup function
		return () => {
			// Clean up auth listeners when available
			if (cleanup instanceof Promise) {
				cleanup
					.then((cleanupFn) => {
						if (cleanupFn) cleanupFn();
					})
					.catch((err) => {
						console.error('Error in auth cleanup:', err);
					});
			}
		};
	});

	// Use $effect for reactive code in Svelte 5 (runes mode)
	$effect(() => {
		if ($page.url.pathname !== currentPath && currentPath !== '') {
			console.log(`Navigation detected from ${currentPath} to ${$page.url.pathname}`);
			currentPath = $page.url.pathname;

			// Optional: If you want to reload the page on every navigation
			window.location.reload();
		}
	});

	// Use SvelteKit's navigation hooks
	beforeNavigate(({ from, to, cancel }) => {
		if (from && to && from.url.pathname !== to.url.pathname) {
			console.log(`Navigating from ${from.url.pathname} to ${to.url.pathname}`);
			// If you want to perform actions before navigation happens
			// You can also cancel the navigation with cancel()
		}
	});

	afterNavigate(({ from, to }) => {
		if (from && to && from.url.pathname !== to.url.pathname) {
			console.log(`Navigated from ${from.url.pathname} to ${to.url.pathname}`);
			// This is the recommended place to handle post-navigation logic
			// It's better than manually reloading the page

			// If you absolutely need to reload the page:
			window.location.reload();
		}
	});
</script>

{@render children()}
