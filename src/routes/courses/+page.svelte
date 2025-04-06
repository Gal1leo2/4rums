<!-- src/routes/courses/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';

  let activeCourses = [];
  let inactiveCourses = [];
  let loading = true;
  
  onMount(async () => {
    // Check if user is authenticated
    if (!$user) {
      loading = false;
      return;
    }
    
    // Load all course data from your API
    const { data, error } = await supabase
      .from('course_members')
      .select(`
        role,
        courses:course_id (
          id, 
          code, 
          name,
          term,
          description,
          is_active
        )
      `)
      .eq('user_id', $user.id);
      
    if (error) {
      console.error('Error loading courses:', error);
      loading = false;
      return;
    }
    
    console.log('Raw course data:', data);
    
    // Separate active and inactive courses based on the 'is_active' field
    activeCourses = data
      .filter(item => item.courses && item.courses.is_active === true)
      .map(item => ({
        id: item.courses.id,
        code: item.courses.code,
        name: item.courses.name,
        term: item.courses.term,
        description: item.courses.description,
        role: item.role
      }));
      
    inactiveCourses = data
      .filter(item => item.courses && item.courses.is_active === false)
      .map(item => ({
        id: item.courses.id,
        code: item.courses.code,
        name: item.courses.name,
        term: item.courses.term,
        description: item.courses.description,
        role: item.role
      }));
    
    console.log('Active courses:', activeCourses);
    console.log('Inactive courses:', inactiveCourses);
    
    loading = false;
  });
  
  // Helper function to determine term icon
  function getTermIcon(term) {
    if (!term) return '📚';
    const termLower = String(term).toLowerCase();
    if (termLower.includes('spring') || termLower.includes('semester 1')) return '🌱';
    if (termLower.includes('fall') || termLower.includes('semester 2')) return '🍂';
    if (termLower.includes('summer')) return '☀️';
    if (termLower.includes('winter')) return '❄️';
    return '📚';
  }

  // Get random color for course cards based on course code
  function getCardColor(code) {
    const colors = [
      'border-blue-200 bg-blue-50 hover:bg-blue-100',
      'border-green-200 bg-green-50 hover:bg-green-100',
      'border-purple-200 bg-purple-50 hover:bg-purple-100',
      'border-pink-200 bg-pink-50 hover:bg-pink-100',
      'border-yellow-200 bg-yellow-50 hover:bg-yellow-100',
      'border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
    ];
    
    if (!code) return colors[0];
    
    // Simple hash function to determine color based on course code
    const numericCode = parseInt(String(code).replace(/\D/g, '')) || 0;
    return colors[numericCode % colors.length];
  }
</script>

<div class="container mx-auto py-8 px-4">
  <div class="flex flex-col md:flex-row justify-between items-start mb-8">
      <div>
          <h1 class="text-3xl font-bold mb-2">My Courses</h1>
          <p class="text-muted-foreground">Manage your enrolled courses</p>
      </div>
      
      <div class="mt-4 md:mt-0">
          <Badge variant="outline" class="py-1.5 px-3 flex items-center gap-2">
              <span>🗓️</span>
              <span class="font-normal">Spring 2025</span>
          </Badge>
      </div>
  </div>
  
  {#if loading}
      <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
  {:else if !$user}
      <Card class="border-2 border-dashed">
        <CardContent class="flex flex-col items-center py-16">
          <div class="rounded-full bg-muted p-6 mb-6">
            <!-- Users Icon as SVG -->
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2 class="text-2xl font-semibold mb-4">Sign in to view your courses</h2>
          <p class="text-muted-foreground text-center max-w-md mb-8">
            You need to be logged in to see the courses you're enrolled in.
          </p>
          <Button href="/auth/login?redirect=/courses" size="lg" class="px-8">Sign In</Button>
        </CardContent>
      </Card>
  {:else}
      <!-- Active Courses Section -->
      <section class="mb-10">
          <h2 class="text-xl font-semibold mb-4 flex items-center">
              <span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
              Active Courses
          </h2>
          
          {#if activeCourses.length === 0}
            <div class="text-center py-16 bg-muted/20 rounded-lg border border-dashed">
              <div class="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <h3 class="text-xl font-medium mb-2">You are not enrolled in any active courses</h3>
                <p class="text-muted-foreground">Contact your administrator to join courses</p>
              </div>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each activeCourses as course (course.id)}
                    <Card class={`border-2 h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${getCardColor(course.code)}`}>
                        <CardContent class="p-0">
                            <div class="p-5">
                                <div class="flex items-center gap-2 mb-4">
                                    <Badge variant="outline" class="text-xs font-normal">
                                        {getTermIcon(course.term)} {course.term}
                                    </Badge>
                                    {#if course.role}
                                      <Badge variant="secondary" class="text-xs font-normal capitalize">
                                          {course.role}
                                      </Badge>
                                    {/if}
                                </div>
                                
                                <h3 class="text-gray-500 text-sm mb-1">{course.code}</h3>
                                <h4 class="text-xl font-semibold mb-2">{course.name}</h4>
                                
                                {#if course.description}
                                  <p class="text-sm text-muted-foreground mb-6 line-clamp-2">
                                    {course.description}
                                  </p>
                                {/if}
                                
                                <Separator class="mb-4" />
                                
                                <Button href="/courses/{course.id}" variant="default" class="w-full">
                                    Enter Course
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                {/each}
            </div>
          {/if}
      </section>
      
      <!-- Inactive Courses Section -->
      <section>
          <h2 class="text-xl font-semibold mb-4 flex items-center">
              <span class="inline-block w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
              Inactive Courses
          </h2>
          
          {#if inactiveCourses.length === 0}
            <div class="text-center py-16 bg-muted/20 rounded-lg border border-dashed">
              <div class="flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                  <rect width="20" height="5" x="2" y="3" rx="1"></rect>
                  <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
                  <path d="M10 12h4"></path>
                </svg>
                <h3 class="text-xl font-medium mb-2">You don't have any inactive courses</h3>
                <p class="text-muted-foreground">Courses are archived at the end of the term</p>
              </div>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each inactiveCourses as course (course.id)}
                    <Card class="h-full overflow-hidden bg-muted/10 hover:bg-muted/20 transition-all duration-300 border-muted/50">
                        <CardContent class="p-0">
                            <div class="p-5">
                                <div class="flex items-center gap-2 mb-4">
                                    <Badge variant="outline" class="text-xs font-normal opacity-70">
                                        {getTermIcon(course.term)} {course.term}
                                    </Badge>
                                    {#if course.role}
                                      <Badge variant="outline" class="text-xs font-normal capitalize opacity-70">
                                          {course.role}
                                      </Badge>
                                    {/if}
                                </div>
                                
                                <h3 class="text-gray-500 text-sm mb-1">{course.code}</h3>
                                <h4 class="text-xl font-semibold text-muted-foreground mb-2">{course.name}</h4>
                                
                                {#if course.description}
                                  <p class="text-sm text-muted-foreground mb-6 line-clamp-2 opacity-70">
                                    {course.description}
                                  </p>
                                {/if}
                                
                                <Separator class="mb-4" />
                                
                                <Button href="/courses/{course.id}" variant="outline" class="w-full opacity-80">
                                    View Archive
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                {/each}
            </div>
          {/if}
      </section>
  {/if}
</div>