<!-- src/routes/signout/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { signOut } from '$lib/stores/auth';
  
    onMount(async () => {
      await signOut(); // This clears Supabase session and store
      window.location.href = '/'; // Redirect after signout
    });
  </script>
  
  <p>Signing you out...</p>
  