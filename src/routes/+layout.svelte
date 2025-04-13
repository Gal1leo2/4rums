<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initAuth } from '$lib/stores/auth';
	
	let { children } = $props();
  
	onMount(() => {
	  console.log("Layout mounted, initializing auth");
	  
	  // Initialize authentication
	  const cleanup = initAuth();
	  
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
	  };
	});
  </script>
  
  {@render children()}