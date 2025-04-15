<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  
  // Props
  let { refreshInterval = 10 * 60 * 1000 } = $props(); // Default: 10 minutes
  
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let lastRefresh = Date.now();
  
  // Set up the refresh timer
  onMount(() => {
    refreshTimer = setInterval(refreshSession, refreshInterval);
    
    // Also refresh on user interaction
    document.addEventListener('mousedown', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    
    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
      document.removeEventListener('mousedown', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
    };
  });
  
  // Throttled user activity handler
  function handleUserActivity() {
    // Only refresh if it's been at least 5 minutes since the last refresh
    if (Date.now() - lastRefresh > 5 * 60 * 1000) {
      refreshSession();
    }
  }
  
  // Refresh the session
  async function refreshSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      // Only attempt to refresh if we have a session
      if (data.session) {
        console.log('SessionKeeper: Refreshing session...');
        await supabase.auth.refreshSession();
        lastRefresh = Date.now();
      }
    } catch (err) {
      console.error('SessionKeeper: Error refreshing session:', err);
    }
  }
</script>

<!-- This component doesn't render anything -->