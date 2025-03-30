<!-- src/routes/courses/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Separator } from '$lib/components/ui/separator';
  
    let courses: any[] = [];
    let activeCourses: any[] = [];
    let archivedCourses: any[] = [];
    let loading = true;
    let searchQuery = '';
    let filteredCourses: any[] = [];
    let authInitialized = false;
    
    // Wait for auth to be initialized
    $: if ($user !== null) {
      authInitialized = true;
    }
    
    // Only run this when auth is initialized
    $: if (authInitialized) {
      loadCourses();
    }
    
    async function loadCourses() {
      if (!$user) {
        loading = false;
        return;
      }
      
      // Modified query without the nested subqueries
      const { data, error } = await supabase
        .from('course_members')
        .select(`
          role,
          courses:course_id (
            id,
            code,
            name,
            term,
            is_active,
            description
          )
        `)
        .eq('user_id', $user.id);
        
      if (error) {
        console.error('Error loading courses:', error);
      } else {
        courses = data || [];
        
        // Separate active and archived courses
        activeCourses = courses
          .filter(c => c.courses?.is_active)
          .map(c => ({ 
            ...c.courses, 
            role: c.role,
            member_count: 0, 
            post_count: 0  
          }));
          
        archivedCourses = courses
          .filter(c => c.courses && !c.courses.is_active)
          .map(c => ({ 
            ...c.courses, 
            role: c.role,
            member_count: 0,
            post_count: 0
          }));
          
        filteredCourses = [...activeCourses];
        
        // Fetch member and post counts for each course
        if (courses.length > 0) {
          await Promise.all(
            [...activeCourses, ...archivedCourses].map(async (course) => {
              // Get member count
              const { count: memberCount, error: memberError } = await supabase
                .from('course_members')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id);
                
              if (!memberError) {
                course.member_count = memberCount || 0;
              }
                
              // Get post count  
              const { count: postCount, error: postError } = await supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .eq('course_id', course.id);
                
              if (!postError) {
                course.post_count = postCount || 0;
              }
            })
          );
          
          // Update filtered courses with the new data
          filteredCourses = [...activeCourses];
        }
      }
      
      loading = false;
    }
    
    function filterCourses(query: string, courseList: any[]) {
      if (!query.trim()) return courseList;
      
      const lowerQuery = query.toLowerCase();
      return courseList.filter(course => 
        course.code.toLowerCase().includes(lowerQuery) || 
        course.name.toLowerCase().includes(lowerQuery) ||
        course.term.toLowerCase().includes(lowerQuery)
      );
    }
    
    function handleSearch() {
      if (searchQuery) {
        filteredCourses = filterCourses(searchQuery, activeCourses);
      } else {
        filteredCourses = [...activeCourses];
      }
    }
    
    // Get random pastel color for course cards based on course code
    function getCardColor(courseCode: string) {
      const colors = [
        'bg-blue-50 hover:bg-blue-100 border-blue-200',
        'bg-green-50 hover:bg-green-100 border-green-200',
        'bg-purple-50 hover:bg-purple-100 border-purple-200',
        'bg-pink-50 hover:bg-pink-100 border-pink-200',
        'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
        'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
        'bg-teal-50 hover:bg-teal-100 border-teal-200',
        'bg-orange-50 hover:bg-orange-100 border-orange-200',
      ];
      
      // Use the sum of char codes as simple hash
      const hash = courseCode.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return colors[hash % colors.length];
    }
    
    // Get semester-appropriate emoji for terms
    function getTermEmoji(term: string) {
      const lowerTerm = term.toLowerCase();
      if (lowerTerm.includes('fall')) return '🍂';
      if (lowerTerm.includes('spring')) return '🌱';
      if (lowerTerm.includes('summer')) return '☀️';
      if (lowerTerm.includes('winter')) return '❄️';
      return '📚';
    }
    
    $: searchQuery, handleSearch();
</script>

<div class="container mx-auto py-8 px-4 md:px-6">
  <header class="mb-10">
    <h1 class="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">My Courses</h1>
    <p class="text-muted-foreground">Manage and access all your enrolled courses</p>
  </header>
  
  <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
    <!-- Search Box -->
    <div class="relative w-full max-w-md">
      <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <!-- Search Icon as SVG -->
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
      </div>
      <Input
        placeholder="Search courses by name or code..."
        class="pl-10"
        bind:value={searchQuery}
      />
    </div>
    
    <div class="flex items-center gap-2">
      <Button variant="outline" class="flex items-center gap-1" disabled>
        <!-- Calendar Icon as SVG -->
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
          <line x1="16" x2="16" y1="2" y2="6"></line>
          <line x1="8" x2="8" y1="2" y2="6"></line>
          <line x1="3" x2="21" y1="10" y2="10"></line>
        </svg>
        <span class="hidden md:inline">Current Term:</span> Spring 2025
      </Button>
    </div>
  </div>
  
  {#if loading}
    <div class="flex flex-col items-center justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      <p class="mt-4 text-muted-foreground">Loading your courses...</p>
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
          You need to be logged in to see the courses you're enrolled in and access your learning materials.
        </p>
        <Button href="/auth/login?redirect=/courses" size="lg" class="px-8">Sign In</Button>
      </CardContent>
    </Card>
  {:else}
    <Tabs defaultValue="active" class="w-full">
      <div class="border-b mb-8">
        <TabsList class="w-full sm:w-auto bg-transparent p-0 h-auto space-x-0">
          <TabsTrigger value="active" class="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 bg-transparent data-[state=active]:text-foreground">
            <div class="flex items-center gap-2">
              <!-- Book Icon as SVG -->
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
              <span>Active Courses ({activeCourses.length})</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="archived" class="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 bg-transparent data-[state=active]:text-foreground">
            <div class="flex items-center gap-2">
              <!-- Archive Icon as SVG -->
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="5" x="2" y="3" rx="1"></rect>
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
                <path d="M10 12h4"></path>
              </svg>
              <span>Archived Courses ({archivedCourses.length})</span>
            </div>
          </TabsTrigger>
        </TabsList>
      </div>
      
      <TabsContent value="active" class="mt-0">
        {#if filteredCourses.length === 0}
          <div class="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
            {#if searchQuery}
              <div class="flex flex-col items-center">
                <!-- Search Icon as SVG -->
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
                <h3 class="text-xl font-medium mb-2">No courses match your search</h3>
                <p class="text-muted-foreground">Try adjusting your search terms or clear the search</p>
                <Button variant="ghost" class="mt-4" on:click={() => { searchQuery = ''; handleSearch(); }}>
                  Clear Search
                </Button>
              </div>
            {:else}
              <div class="flex flex-col items-center">
                <!-- Book Icon as SVG -->
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <h3 class="text-xl font-medium mb-2">You are not enrolled in any active courses</h3>
                <p class="text-muted-foreground">Contact your administrator to join courses</p>
              </div>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each filteredCourses as course}
              <Card class={`h-full flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md border-2 ${getCardColor(course.code)}`}>
                <CardHeader class="pb-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <div class="flex items-center mb-1 gap-2">
                        <Badge variant="secondary" class="capitalize text-xs font-normal">{course.role}</Badge>
                        <Badge variant="outline" class="text-xs font-normal">{getTermEmoji(course.term)} {course.term}</Badge>
                      </div>
                      <CardTitle class="text-xl">
                        <a href="/courses/{course.id}" class="hover:text-primary transition-colors">
                          {course.code}
                        </a>
                      </CardTitle>
                      <CardDescription class="line-clamp-1">{course.name}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent class="flex-grow pb-4">
                  <p class="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {course.description || 'No description available for this course.'}
                  </p>
                  
                  <div class="grid grid-cols-2 gap-2 mt-auto">
                    <div class="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <!-- Users Icon as SVG -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>{course.member_count}</span>
                    </div>
                    
                    <div class="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                      <!-- Book Icon as SVG -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                      <span>{course.post_count}</span>
                    </div>
                  </div>
                </CardContent>
                
                <Separator />
                
                <CardFooter class="pt-4">
                  <Button href="/courses/{course.id}" variant="default" class="w-full">
                    Enter Course
                  </Button>
                </CardFooter>
              </Card>
            {/each}
          </div>
        {/if}
      </TabsContent>
      
      <TabsContent value="archived" class="mt-0">
        {#if archivedCourses.length === 0}
          <div class="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
            <div class="flex flex-col items-center">
              <!-- Archive Icon as SVG -->
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                <rect width="20" height="5" x="2" y="3" rx="1"></rect>
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
                <path d="M10 12h4"></path>
              </svg>
              <h3 class="text-xl font-medium mb-2">You don't have any archived courses</h3>
              <p class="text-muted-foreground">Courses are archived at the end of the term</p>
            </div>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each archivedCourses as course}
              <Card class="h-full flex flex-col bg-muted/10 hover:bg-muted/20 transition-all duration-300 border-muted/50">
                <CardHeader class="pb-3">
                  <div class="flex justify-between items-start">
                    <div>
                      <div class="flex items-center mb-1 gap-2">
                        <Badge variant="outline" class="capitalize text-xs font-normal opacity-70">{course.role}</Badge>
                        <Badge variant="outline" class="text-xs font-normal opacity-70">{getTermEmoji(course.term)} {course.term}</Badge>
                      </div>
                      <CardTitle class="text-xl text-muted-foreground">
                        <a href="/courses/{course.id}" class="hover:text-primary transition-colors">
                          {course.code}
                        </a>
                      </CardTitle>
                      <CardDescription class="line-clamp-1 opacity-70">{course.name}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent class="flex-grow pb-4">
                  <p class="text-sm text-muted-foreground mb-4 line-clamp-2 opacity-70">
                    {course.description || 'No description available for this course.'}
                  </p>
                  
                  <div class="grid grid-cols-2 gap-2 mt-auto opacity-70">
                    <div class="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30">
                      <!-- Users Icon as SVG -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>{course.member_count}</span>
                    </div>
                    
                    <div class="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/30">
                      <!-- Book Icon as SVG -->
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                      <span>{course.post_count}</span>
                    </div>
                  </div>
                </CardContent>
                
                <Separator />
                
                <CardFooter class="pt-4">
                  <Button href="/courses/{course.id}" variant="outline" class="w-full opacity-80">
                    View Archive
                  </Button>
                </CardFooter>
              </Card>
            {/each}
          </div>
        {/if}
      </TabsContent>
    </Tabs>
  {/if}
</div>