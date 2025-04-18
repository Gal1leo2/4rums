<!-- src/routes/profile/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Label } from '$lib/components/ui/label';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
  import { Switch } from '$lib/components/ui/switch';
  import { Alert, AlertDescription } from '$lib/components/ui/alert';
  
  // TypeScript interfaces
  interface ProfileData {
    id: string;
    email: string;
    full_name: string;
    role: string;
    created_at: string;
    last_login?: string;
  }
  
  interface CourseEnrollment {
    role: string;
    courses: {
      id: string;
      code: string;
      name: string;
      term: string;
      is_active: boolean;
    };
  }
  
  interface NotificationSettings {
    newPosts: boolean;
    responses: boolean;
    endorsements: boolean;
    courseAnnouncements: boolean;
  }

  // State variables
  let profile: ProfileData | null = null;
  let courses: CourseEnrollment[] = [];
  let loading: boolean = true;
  let updating: boolean = false;
  let success: string = '';
  let error: string = '';
  
  // Form fields
  let fullName: string = '';
  let email: string = '';
  let currentPassword: string = '';
  let newPassword: string = '';
  let confirmPassword: string = '';
  
  // Notification settings
  let emailNotifications: NotificationSettings = {
    newPosts: true,
    responses: true,
    endorsements: true,
    courseAnnouncements: true
  };
  
  onMount(async () => {
    // Authentication guard
    if (!$user) {
      const { data } = await supabase.auth.getSession();
        
      if (!data.session) {
        console.log("No authenticated user found, redirecting to login");
        const currentPath = window.location.pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        return; // Stop further execution
      }
    }
    
    await loadUserProfile();
  });
  
  async function loadUserProfile(): Promise<void> {
    try {

      
      // Load user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', $user.id)
        .single();
        
      if (profileError) {
        console.error('Error loading profile:', profileError);
      } else {
        profile = profileData;
        fullName = profile.full_name;
        email = profile.email;
      }
      
      // Load enrolled courses
      const { data: courseData, error: courseError } = await supabase
        .from('course_members')
        .select(`
          role,
          courses (
            id,
            code,
            name,
            term,
            is_active
          )
        `)
        .eq('user_id', $user.id)
        .order('joined_at', { ascending: false });
        
      if (courseError) {
        console.error('Error loading courses:', courseError);
      } else {
        courses = courseData || [];
      }
    } catch (err) {
      console.error('Error in loadUserProfile:', err);
    } finally {
      loading = false;
    }
  }
  
  async function updateProfile(): Promise<void> {
    if (!fullName.trim()) {
      error = 'Full name is required';
      return;
    }
    
    updating = true;
    error = '';
    success = '';
    
    try {
      // Update profile information
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', $user?.id);
        
      if (updateError) {
        console.error('Error updating profile:', updateError);
        error = 'Failed to update profile. Please try again.';
      } else {
        success = 'Profile updated successfully!';
        
        // Update user metadata
        await supabase.auth.updateUser({
          data: { full_name: fullName }
        });
      }
    } catch (err) {
      console.error('Error in updateProfile:', err);
      error = 'An unexpected error occurred';
    } finally {
      updating = false;
    }
  }

  async function changePassword(): Promise<void> {
    if (!currentPassword || !newPassword || !confirmPassword) {
      error = 'All password fields are required';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      error = 'New passwords do not match';
      return;
    }
    
    if (newPassword.length < 8) {
      error = 'New password must be at least 8 characters';
      return;
    }
    
    updating = true;
    error = '';
    success = '';
    
    try {
      // Change password using Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (passwordError) {
        console.error('Error changing password:', passwordError);
        error = 'Failed to change password. Please try again.';
      } else {
        success = 'Password changed successfully!';
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
      }
    } catch (err) {
      console.error('Error in changePassword:', err);
      error = 'An unexpected error occurred';
    } finally {
      updating = false;
    }
  }
  
  async function saveNotificationSettings(): Promise<void> {
    updating = true;
    error = '';
    success = '';
    
    try {
      // In a real app, you would save these settings to the database
      // For this example, we'll just simulate success
      
      setTimeout(() => {
        success = 'Notification settings saved!';
        updating = false;
      }, 500);
    } catch (err) {
      console.error('Error in saveNotificationSettings:', err);
      error = 'An unexpected error occurred';
      updating = false;
    }
  }
  
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }
</script>

<div class="container mx-auto py-8 max-w-4xl">
{#if loading}
  <div class="flex justify-center py-12">
    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
  </div>
{:else if profile}
  <h1 class="text-3xl font-bold mb-6">Your Profile</h1>
  
  <Tabs defaultValue="profile" class="w-full">
    <TabsList class="grid w-full grid-cols-3">
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="courses">My Courses</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
    </TabsList>
    
    <!-- Profile Tab -->
    <TabsContent value="profile">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Manage your account details</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          {#if success}
            <Alert class="bg-green-50 text-green-800 border-green-200">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          {/if}
          
          {#if error}
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          {/if}
          
          <div class="flex items-center gap-4">
            <Avatar class="h-20 w-20">
              <AvatarFallback class="text-xl">{getInitials(fullName)}</AvatarFallback>
            </Avatar>
            
            <div>
              <h3 class="text-lg font-medium">{fullName}</h3>
              <p class="text-sm text-muted-foreground">{profile.role}</p>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="space-y-2">
              <Label for="fullName">Full Name</Label>
              <Input id="fullName" bind:value={fullName} />
            </div>
            
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input id="email" value={email} disabled />
              <p class="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            
            <Button onclick={updateProfile} disabled={updating}>
              {updating ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
          
          <div class="border-t pt-4 mt-6">
            <h3 class="text-lg font-medium mb-4">Change Password</h3>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <Label for="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" bind:value={currentPassword} />
              </div>
              
              <div class="space-y-2">
                <Label for="newPassword">New Password</Label>
                <Input id="newPassword" type="password" bind:value={newPassword} />
              </div>
              
              <div class="space-y-2">
                <Label for="confirmPassword">Confirm New Password</Label>
                <Input id="confirmPassword" type="password" bind:value={confirmPassword} />
              </div>
              
              <Button onclick={changePassword} disabled={updating} variant="outline">
                {updating ? 'Updating...' : 'Change Password'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
    
    <!-- Courses Tab -->
    <TabsContent value="courses">
      <Card>
        <CardHeader>
          <CardTitle>My Courses</CardTitle>
          <CardDescription>Courses you're enrolled in</CardDescription>
        </CardHeader>
        <CardContent>
          {#if courses.length === 0}
            <p class="text-center py-4 text-muted-foreground">
              You are not enrolled in any courses yet.
            </p>
          {:else}
            <div class="space-y-4">
              {#each courses as enrollment (enrollment.courses.id)}
                <Card>
                  <CardContent class="p-4">
                    <div class="flex justify-between items-center">
                      <div>
                        <h3 class="font-medium">
                          <a href="/courses/{enrollment.courses.id}" class="hover:underline">
                            {enrollment.courses.code}: {enrollment.courses.name}
                          </a>
                        </h3>
                        <p class="text-sm text-muted-foreground">
                          {enrollment.courses.term} • 
                          <span class="capitalize">{enrollment.role}</span>
                        </p>
                      </div>
                      <div>
                        {#if enrollment.courses.is_active}
                          <div class="bg-green-50 text-green-800 border-green-200 px-2 py-1 text-xs rounded-full border">Active</div>
                        {:else}
                          <div class="bg-gray-50 text-gray-800 border-gray-200 px-2 py-1 text-xs rounded-full border">Archived</div>
                        {/if}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              {/each}
            </div>
          {/if}
        </CardContent>
      </Card>
    </TabsContent>
    
    <!-- Notifications Tab -->
    <TabsContent value="notifications">
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Control how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          {#if success}
            <Alert class="bg-green-50 text-green-800 border-green-200">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          {/if}
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <Label for="newPosts" class="text-base">New posts in enrolled courses</Label>
                <p class="text-sm text-muted-foreground">
                  Get notified when new questions are posted
                </p>
              </div>
              <Switch id="newPosts" bind:checked={emailNotifications.newPosts} />
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <Label for="responses" class="text-base">Responses to your posts</Label>
                <p class="text-sm text-muted-foreground">
                  Get notified when someone answers your questions
                </p>
              </div>
              <Switch id="responses" bind:checked={emailNotifications.responses} />
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <Label for="endorsements" class="text-base">Endorsements</Label>
                <p class="text-sm text-muted-foreground">
                  Get notified when an instructor endorses your response
                </p>
              </div>
              <Switch id="endorsements" bind:checked={emailNotifications.endorsements} />
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <Label for="announcements" class="text-base">Course announcements</Label>
                <p class="text-sm text-muted-foreground">
                  Get notified about course announcements
                </p>
              </div>
              <Switch id="announcements" bind:checked={emailNotifications.courseAnnouncements} />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onclick={saveNotificationSettings} disabled={updating}>
            {updating ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardFooter>
      </Card>
    </TabsContent>
  </Tabs>
{:else}
  <div class="text-center py-12">
    <p>Please sign in to view your profile</p>
    <Button href="/auth/login?redirect=/profile" class="mt-4">
      Sign In
    </Button>
  </div>
{/if}
</div>