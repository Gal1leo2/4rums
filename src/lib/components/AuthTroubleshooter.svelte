<!-- src/lib/components/AuthTroubleshooter.svelte
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { user } from '$lib/stores/auth';
    import { supabase } from '$lib/supabase/client';
    import { Button } from '$lib/components/ui/button';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    
    props visible = false;
    
    let sessionInfo: any = null;
    let authStatus = 'checking';
    let authError: any = null;
    let checkInterval: any = null;
    
    // Reset state and check auth status when component mounts or becomes visible
    $effect(() => {
      if (visible) {
        checkAuthStatus();
        
        // Set up interval to periodically check auth status
        checkInterval = setInterval(checkAuthStatus, 5000);
        
        // Clean up interval
        return () => {
          if (checkInterval) clearInterval(checkInterval);
        };
      } else {
        if (checkInterval) clearInterval(checkInterval);
      }
    });
    
    async function checkAuthStatus() {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          authStatus = 'error';
          authError = error;
          return;
        }
        
        sessionInfo = data.session;
        
        if (data.session) {
          // We have a session, check if user store is populated
          if ($user && $user.id === data.session.user.id) {
            authStatus = 'synchronized';
          } else {
            authStatus = 'session-only';
          }
        } else {
          // No session
          if ($user) {
            authStatus = 'store-only';
          } else {
            authStatus = 'not-authenticated';
          }
        }
      } catch (err) {
        authStatus = 'error';
        authError = err;
      }
    }
    
    function refreshPage() {
      window.location.reload();
    }
    
    function clearAuthAndRefresh() {
      localStorage.clear();
      sessionStorage.clear();
      // Clear IndexedDB storage (used by Supabase)
      indexedDB.deleteDatabase('supabase-auth-db');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  </script>
  
  {#if visible}
    <div class="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-background border rounded-lg shadow-lg p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Auth Troubleshooter</h3>
        <Button variant="outline" size="sm" onclick={() => visible = false}>Close</Button>
      </div>
      
      <!-- Auth Status -->
      <div class="space-y-2">
        <div class="text-sm font-medium">Authentication Status:</div>
        
        {#if authStatus === 'checking'}
          <div class="bg-muted p-2 rounded flex items-center gap-2 text-sm">
            <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
            Checking...
          </div>
        {:else if authStatus === 'synchronized'}
          <Alert variant="default" class="border-green-200 bg-green-50 text-green-800">
            <AlertTitle>✅ Synchronized</AlertTitle>
            <AlertDescription class="text-xs">
              Auth is properly synchronized with a valid session.
            </AlertDescription>
          </Alert>
        {:else if authStatus === 'session-only'}
          <Alert variant="default" class="border-yellow-200 bg-yellow-50 text-yellow-800">
            <AlertTitle>⚠️ Session Only</AlertTitle>
            <AlertDescription class="text-xs">
              You have a valid session but the user store isn't populated.
            </AlertDescription>
          </Alert>
        {:else if authStatus === 'store-only'}
          <Alert variant="default" class="border-orange-200 bg-orange-50 text-orange-800">
            <AlertTitle>⚠️ Store Only</AlertTitle>
            <AlertDescription class="text-xs">
              User store is populated but you don't have a valid session.
            </AlertDescription>
          </Alert>
        {:else if authStatus === 'not-authenticated'}
          <Alert variant="default" class="border-blue-200 bg-blue-50 text-blue-800">
            <AlertTitle>ℹ️ Not Authenticated</AlertTitle>
            <AlertDescription class="text-xs">
              No active session or user data (this is normal if you're not logged in).
            </AlertDescription>
          </Alert>
        {:else if authStatus === 'error'}
          <Alert variant="destructive">
            <AlertTitle>🚫 Auth Error</AlertTitle>
            <AlertDescription class="text-xs">
              Error checking auth status: {authError?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        {/if}
      </div>
      
      <!-- Actions -->
      <div class="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onclick={refreshPage}>
          Refresh Page
        </Button>
        <Button variant="outline" size="sm" onclick={clearAuthAndRefresh}>
          Clear & Refresh
        </Button>
      </div>
      
      <!-- Session Info -->
      {#if sessionInfo}
        <div class="mt-2">
          <div class="text-xs font-medium mb-1">Session Info:</div>
          <div class="text-xs bg-muted/40 p-2 rounded h-24 overflow-auto">
            <pre>User ID: {sessionInfo.user.id}</pre>
            <pre>Email: {sessionInfo.user.email}</pre>
            <pre>Expires: {new Date(sessionInfo.expires_at * 1000).toLocaleString()}</pre>
          </div>
        </div>
      {/if}
    </div>
  {/if} -->