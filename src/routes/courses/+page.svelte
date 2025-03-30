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
    // import { Loader2, Search, BookOpen, Clock, Users } from 'lucide-svelte';
  
    let courses: any[] = [];
    let activeCourses: any[] = [];
    let archivedCourses: any[] = [];
    let loading = true;
    let searchQuery = '';
    let filteredCourses: any[] = [];
    
    onMount(async () => {
      // Check if user is authenticated
      if (!$user) {
        loading = false;
        return;
      }
      
      // Load user's courses
      const { data, error } = await supabase
        .from('course_members')
        .select(`
          role,
          courses (
            id,
            code,
            name,
            term,
            is_active,
            description,
            (
              select count(*) from course_members cm
              where cm.course_id = courses.id
            ) as member_count,
            (
              select count(*) from posts
              where course_id = courses.id
            ) as post_count
          )
        `)
        .eq('user_id', $user.id);
        
      if (error) {
        console.error('Error loading courses:', error);
      } else {
        courses = data || [];
        
        // Separate active and archived courses
        activeCourses = courses
          .filter(c => c.courses.is_active)
          .map(c => ({ ...c.courses, role: c.role }));
          
        archivedCourses = courses
          .filter(c => !c.courses.is_active)
          .map(c => ({ ...c.courses, role: c.role }));
          
        filteredCourses = [...activeCourses];
      }
      
      loading = false;
    });
    
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
        <!-- <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /> -->
        <Input
          placeholder="Search courses..."
          class="pl-10"
          bind:value={searchQuery}
        />
      </div>
    </div>
    
    {#if loading}
      <div class="flex justify-center py-12">
        <!-- <Loader2 class="h-8 w-8 animate-spin" /> -->
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
                        <!-- <Clock class="h-4 w-4 text-muted-foreground" /> -->
                        <span>{course.term}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <!-- <Users class="h-4 w-4 text-muted-foreground" /> -->
                        <span>{course.member_count} {course.member_count === 1 ? 'member' : 'members'}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <!-- <BookOpen class="h-4 w-4 text-muted-foreground" /> -->
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
                        <!-- <Clock class="h-4 w-4 text-muted-foreground" /> -->
                        <span>{course.term}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <!-- <Users class="h-4 w-4 text-muted-foreground" /> -->
                        <span>{course.member_count} {course.member_count === 1 ? 'member' : 'members'}</span>
                      </div>
                      
                      <div class="flex items-center gap-2 text-sm">
                        <!-- <BookOpen class="h-4 w-4 text-muted-foreground" /> -->
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