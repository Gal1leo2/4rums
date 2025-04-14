<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initAuth } from '$lib/stores/auth';
	
	let { children } = $props();
  
	onMount(() => {
	  console.log("Layout mounted, initializing auth");
	  
	  // Initialize authentication
	  const cleanup = initAuth();
	  
	  // Simple approach: Set up back/forward button listener to reload page
	  const handlePopState = () => {
		console.log('Back/forward button pressed, reloading page');
		window.location.reload();
	  };
	  
	  window.addEventListener('popstate', handlePopState);
	  
	  // Return a synchronous cleanup function
	  return () => {
		// Clean up auth listeners when available
		if (cleanup instanceof Promise) {
		  cleanup.then(cleanupFn => {
			if (cleanupFn) cleanupFn();
		  }).catch(err => {
			console.error("Error in auth cleanup:", err);
		  });
		}
		
		// Remove popstate listener
		window.removeEventListener('popstate', handlePopState);
	  };
	});
  </script>
  
  {@render children()}