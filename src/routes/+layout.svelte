<script lang="ts">
	import '../app.css';	
	let { children } = $props();

	import { onMount } from 'svelte';
	import { initAuth, user } from '$lib/stores/authSync';

	onMount(() => {
     initAuth();
	
  });
</script>

{@render children()}