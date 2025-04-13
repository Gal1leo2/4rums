
<!-- src/routes/debug/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '$lib/components/ui/card';
    import { Alert, AlertDescription } from '$lib/components/ui/alert';
  
    let session = null;
    let storeUser = null;
    let dbUser = null;
    let courseMembers = [];
    let loading = true;
    let error = null;
  
    // Subscribe to the user store
    $: storeUser = $user;
  
    onMount(async () => {
      try {
        // Check direct session
        const { data: sessionData } = await supabase.auth.getSession();
        session = sessionData.session;
        
        if (session?.user) {
          // Fetch user from database
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
            
          if (userError) {
            console.error('Error fetching user:', userError);
            error = `Error fetching user: ${userError.message}`;
          } else {
            dbUser = userData;
            
            // Fetch course memberships
            const { data: courseData, error: courseError } = await supabase
              .from('course_members')
              .select(`
                role,
                courses:course_id (
                  id, 
                  code, 
                  name
                )
              `)
              .eq('user_id', session.user.id);
              
            if (courseError) {
              console.error('Error fetching courses:', courseError);
              error = `Error fetching courses: ${courseError.message}`;
            } else {
              courseMembers = courseData || [];
            }
          }
        }
      } catch (err) {
        console.error('Error in debug page:', err);
        error = `Unexpected error: ${err.message}`;
      } finally {
        loading = false;
      }
    });
  
    async function refreshSession() {
      loading = true;
      error = null;
      
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Error refreshing session:', refreshError);
          error = `Error refreshing session: ${refreshError.message}`;
        } else {
          session = data.session;
          window.location.reload();
        }
      } catch (err) {
        console.error('Error refreshing session:', err);
        error = `Error in refresh: ${err.message}`;
      } finally {
        loading = false;
      }
    }
    
    async function signOut() {
      await supabase.auth.signOut();
      window.location.reload();
    }
  </script>
  
  <div class="container mx-auto py-8 max-w-3xl px-4">
    <h1 class="text-2xl font-bold mb-6">Authentication Debug</h1>
    
    {#if loading}
      <div class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    {:else}
      {#if error}
        <Alert variant="destructive" class="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      {/if}
      
      <div class="grid gap-6">
        <!-- Session Status -->
        <Card>
          <CardHeader>
            <CardTitle>Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            {#if session}
              <div class="bg-green-50 text-green-800 px-4 py-2 rounded-md mb-4">
                ✅ Active Session
              </div>
              <div class="space-y-2 text-sm">
                <p><strong>User ID:</strong> {session.user.id}</p>
                <p><strong>Email:</strong> {session.user.email}</p>
                <p><strong>Created At:</strong> {new Date(session.user.created_at).toLocaleString()}</p>
                <p><strong>Last Sign In:</strong> {new Date(session.user.last_sign_in_at).toLocaleString()}</p>
                <p><strong>Session Expires:</strong> {new Date(session.expires_at * 1000).toLocaleString()}</p>
              </div>
            {:else}
              <div class="bg-red-50 text-red-800 px-4 py-2 rounded-md">
                ❌ No Active Session
              </div>
            {/if}
          </CardContent>
          <CardFooter>
            <div class="flex gap-2">
              <Button on:click={refreshSession} disabled={loading}>Refresh Session</Button>
              {#if session}
                <Button variant="outline" on:click={signOut}>Sign Out</Button>
              {:else}
                <Button href="/auth/login">Sign In</Button>
              {/if}
            </div>
          </CardFooter>
        </Card>
        
        <!-- Store Status -->
        <Card>
          <CardHeader>
            <CardTitle>Auth Store Status</CardTitle>
          </CardHeader>
          <CardContent>
            {#if storeUser}
              <div class="bg-green-50 text-green-800 px-4 py-2 rounded-md mb-4">
                ✅ User in Store
              </div>
              <div class="space-y-2 text-sm">
                <p><strong>User ID:</strong> {storeUser.id}</p>
                <p><strong>Email:</strong> {storeUser.email}</p>
                <p><strong>Full Name:</strong> {storeUser.full_name}</p>
                <p><strong>Role:</strong> {storeUser.role}</p>
              </div>
            {:else}
              <div class="bg-red-50 text-red-800 px-4 py-2 rounded-md">
                ❌ No User in Store
              </div>
              <p class="mt-4 text-sm text-muted-foreground">
                This means the auth store has not been properly initialized or the user is not logged in.
              </p>
            {/if}
          </CardContent>
        </Card>
        
        <!-- Database User -->
        <Card>
          <CardHeader>
            <CardTitle>Database User Status</CardTitle>
          </CardHeader>
          <CardContent>
            {#if dbUser}
              <div class="bg-green-50 text-green-800 px-4 py-2 rounded-md mb-4">
                ✅ User in Database
              </div>
              <div class="space-y-2 text-sm">
                <p><strong>User ID:</strong> {dbUser.id}</p>
                <p><strong>Email:</strong> {dbUser.email}</p>
                <p><strong>Full Name:</strong> {dbUser.full_name}</p>
                <p><strong>Role:</strong> {dbUser.role}</p>
                <p><strong>Created At:</strong> {new Date(dbUser.created_at).toLocaleString()}</p>
                <p><strong>Last Login:</strong> {dbUser.last_login ? new Date(dbUser.last_login).toLocaleString() : 'Never'}</p>
              </div>
            {:else if session}
              <div class="bg-red-50 text-red-800 px-4 py-2 rounded-md mb-4">
                ❌ User Not Found in Database
              </div>
              <p class="mt-4 text-sm text-muted-foreground">
                You're authenticated with Supabase Auth, but your user record doesn't exist in the users table.
                This is likely the source of your authentication issues.
              </p>
            {:else}
              <div class="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-md">
                ⚠️ No Session to Check Database
              </div>
            {/if}
          </CardContent>
        </Card>
        
        <!-- Course Memberships -->
        {#if session}
          <Card>
            <CardHeader>
              <CardTitle>Course Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              {#if courseMembers.length === 0}
                <div class="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-md">
                  ⚠️ No Course Memberships Found
                </div>
                <p class="mt-4 text-sm text-muted-foreground">
                  You don't have any course memberships. This explains why no courses appear on your courses page.
                </p>
              {:else}
                <div class="bg-green-50 text-green-800 px-4 py-2 rounded-md mb-4">
                  ✅ Course Memberships Found ({courseMembers.length})
                </div>
                <ul class="space-y-2">
                  {#each courseMembers as membership}
                    <li class="border rounded-md p-3">
                      <p><strong>{membership.courses?.code}: {membership.courses?.name}</strong></p>
                      <p class="text-sm text-muted-foreground">Role: {membership.role}</p>
                    </li>
                  {/each}
                </ul>
              {/if}
            </CardContent>
          </Card>
        {/if}
      </div>
      
      <div class="mt-8 text-center">
        <Button href="/courses">Return to Courses</Button>
      </div>
    {/if}
  </div>