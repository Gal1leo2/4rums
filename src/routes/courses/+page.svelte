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
      
      console.log("Loading courses for user:", $user.id);
      
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
    
    $: searchQuery, handleSearch();
  </script>
  
  <div class="container mx-auto py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">My Courses</h1>
      
      <!-- Search Box -->
      <div class="relative w-full max-w-sm">
        <Input
          placeholder="Search courses..."
          class="pl-3"
          bind:value={searchQuery}
        />
      </div>
    </div>
    
    {#if loading}
      <div class="flex justify-center py-12">
        <p>Loading...</p>
      </div>
    {:else if !$user}
      <Card>
        <CardContent class="flex flex-col items-center py-12">
          <h2 class="text-xl font-semibold mb-4">Sign in to view your courses</h2>
          <p class="text-muted-foreground mb-6">
            You need to be logged in to see the courses you're enrolled in.
          </p>
          <Button href="/auth/login?redirect=/courses">Sign In</Button>
        </CardContent>
      </Card>
    {:else}
      <Tabs defaultValue="active" class="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Courses ({activeCourses.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived Courses ({archivedCourses.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" class="mt-4">
          {#if filteredCourses.length === 0}
            <div class="text-center py-12 text-muted-foreground">
              {searchQuery ? 'No courses match your search' : 'You are not enrolled in any active courses'}
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {#each filteredCourses as course}
                <Card class="h-full flex flex-col">
                  <CardHeader>
                    <div class="flex justify-between items-start">
                      <div>
                        <CardTitle>
                          <a href="/courses/{course.id}" class="hover:text-primary">
                            {course.code}
                          </a>
                        </CardTitle>
                        <CardDescription>{course.name}</CardDescription>
                      </div>
                      <Badge variant="outline" class="capitalize">{course.role}</Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent class="flex-grow">
                    <p class="text-sm text-muted-foreground mb-4">
                      {course.description || 'No description available'}
                    </p>
                    
                    <div class="flex flex-col space-y-2">
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.term}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.member_count} {course.member_count === 1 ? 'member' : 'members'}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.post_count} {course.post_count === 1 ? 'post' : 'posts'}</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button href="/courses/{course.id}" variant="outline" class="w-full">
                      Enter Course
                    </Button>
                  </CardFooter>
                </Card>
              {/each}
            </div>
          {/if}
        </TabsContent>
        
        <TabsContent value="archived" class="mt-4">
          {#if archivedCourses.length === 0}
            <div class="text-center py-12 text-muted-foreground">
              You don't have any archived courses
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {#each archivedCourses as course}
                <Card class="h-full flex flex-col opacity-75 hover:opacity-100 transition-opacity">
                  <CardHeader>
                    <div class="flex justify-between items-start">
                      <div>
                        <CardTitle>
                          <a href="/courses/{course.id}" class="hover:text-primary">
                            {course.code}
                          </a>
                        </CardTitle>
                        <CardDescription>{course.name}</CardDescription>
                      </div>
                      <Badge variant="secondary" class="capitalize">{course.role}</Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent class="flex-grow">
                    <p class="text-sm text-muted-foreground mb-4">
                      {course.description || 'No description available'}
                    </p>
                    
                    <div class="flex flex-col space-y-2">
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.term}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.member_count} {course.member_count === 1 ? 'member' : 'members'}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <span>{course.post_count} {course.post_count === 1 ? 'post' : 'posts'}</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button href="/courses/{course.id}" variant="outline" class="w-full">
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