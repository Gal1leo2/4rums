<!-- src/routes/courses/[id]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';

  const courseId = $page.params.id;
  let posts = [];
  let allPosts = [];
  let questionPosts = [];
  let announcementPosts = [];
  let loading = true;
  let course = null;
  let searchQuery = '';
  let userRole = '';

  // Function to load course and posts data
  async function loadCourseAndPosts() {
    // Fetch course details
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    
    if (courseError) {
      console.error('Error loading course:', courseError);
      loading = false;
      return;
    }
    
    course = courseData;
    
    // Get user's role in this course if logged in
    if ($user) {
      const { data: memberData } = await supabase
        .from('course_members')
        .select('role')
        .eq('course_id', courseId)
        .eq('user_id', $user.id)
        .single();
        
      if (memberData) {
        userRole = memberData.role;
      }
    }
    
    // Fetch posts with simplified query (no nested subqueries)
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select(`
        id, 
        title, 
        content,
        post_type,
        status,
        created_at,
        anonymous,
        user_id
      `)
      .eq('course_id', courseId)
      .eq('is_private', false)
      .order('created_at', { ascending: false });
    
    if (postsError) {
      console.error('Error loading posts:', postsError);
      loading = false;
      return;
    }

    // Now we need to fetch user details and response counts separately
    const enhancedPosts = await Promise.all(postsData.map(async (post) => {
      // Get user info
      let userInfo = { full_name: 'Unknown', role: 'student' };
      
      if (!post.anonymous) {
        const { data: userData } = await supabase
          .from('users')
          .select('full_name, role')
          .eq('id', post.user_id)
          .single();
        
        if (userData) {
          userInfo = userData;
        }
      }
      
      // Get response count
      const { count: responseCount } = await supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      
      return {
        ...post,
        users: userInfo,
        response_count: responseCount || 0
      };
    }));
    
    allPosts = enhancedPosts;
    questionPosts = enhancedPosts.filter(post => post.post_type === 'question');
    announcementPosts = enhancedPosts.filter(post => post.post_type === 'announcement');
    posts = allPosts;
    
    loading = false;
  }

  onMount(() => {
    loadCourseAndPosts();
  });

  async function searchPosts() {
    loading = true;
    
    // Client-side search when search query is provided
    if (searchQuery.trim() === '') {
      posts = allPosts;
      loading = false;
      return;
    }
    
    const query = searchQuery.toLowerCase();
    posts = allPosts.filter(post => 
      post.title.toLowerCase().includes(query) || 
      post.content.toLowerCase().includes(query)
    );
    
    loading = false;
  }
  
  function handleTabChange(tabValue) {
    switch(tabValue) {
      case 'all':
        posts = allPosts;
        break;
      case 'questions':
        posts = questionPosts;
        break;
      case 'announcements':
        posts = announcementPosts;
        break;
      default:
        posts = allPosts;
    }
  }
  
  // Function to get appropriate status color
  function getStatusColor(status) {
    switch(status) {
      case 'answered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'open':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }
  
  // Format date display
  function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
  
  // Generate initials from name
  function getInitials(name) {
    if (!name || name === 'Unknown') return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }
  
  // Get post type icon
  function getPostTypeIcon(type) {
    if (type === 'question') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <path d="M12 17h.01"></path>
      </svg>`;
    } else if (type === 'announcement') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 4v16"></path>
        <path d="M15 4v16"></path>
        <path d="M11 4v16"></path>
        <path d="M7 4v16"></path>
        <path d="M3 4v16"></path>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>`;
    }
  }
</script>

<div class="container mx-auto py-8 px-4 md:px-6">
{#if course}
  <!-- Course Header -->
  <div class="mb-8">
    <!-- Breadcrumb -->
    <div class="flex items-center text-sm text-muted-foreground mb-4">
      <a href="/courses" class="hover:text-primary transition-colors">Courses</a>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-2 h-4 w-4">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span class="font-medium text-foreground">{course.code}</span>
    </div>
    
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">{course.code}: {course.name}</h1>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-sm px-3">
            <span class="mr-1">{course.term.includes('Fall') ? '🍂' : course.term.includes('Spring') ? '🌱' : course.term.includes('Summer') ? '☀️' : course.term.includes('Winter') ? '❄️' : '📚'}</span>
            {course.term}
          </Badge>
          {#if userRole}
            <Badge variant="secondary" class="text-sm px-3 capitalize">{userRole}</Badge>
          {/if}
        </div>
      </div>
      
      <Button href="/courses/{courseId}/ask" variant="default" class="gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M8 12h8"></path>
          <path d="M12 8v8"></path>
        </svg>
        Ask a Question
      </Button>
    </div>
    
    {#if course.description}
      <p class="mt-4 text-muted-foreground max-w-3xl">{course.description}</p>
    {/if}
  </div>
  
  <Separator class="my-6" />
  
  <!-- Search and Filters -->
  <div class="mb-6">
    <form on:submit|preventDefault={searchPosts} class="flex gap-2 w-full max-w-lg">
      <div class="relative flex-1">
        <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
        </div>
        <Input placeholder="Search questions or announcements..." bind:value={searchQuery} class="pl-10" />
      </div>
      <Button type="submit" variant="default">Search</Button>
    </form>
  </div>
  
  <!-- Content tabs -->
  <Tabs defaultValue="all" class="w-full" onValueChange={handleTabChange}>
    <div class="border-b mb-6">
      <TabsList class="w-full sm:w-auto bg-transparent p-0 h-auto space-x-0">
        <TabsTrigger value="all" class="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 bg-transparent data-[state=active]:text-foreground">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
            <span>All Posts ({allPosts.length})</span>
          </div>
        </TabsTrigger>
        <TabsTrigger value="questions" class="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 bg-transparent data-[state=active]:text-foreground">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
            <span>Questions ({questionPosts.length})</span>
          </div>
        </TabsTrigger>
        <TabsTrigger value="announcements" class="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 bg-transparent data-[state=active]:text-foreground">
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 4v16"></path>
              <path d="M15 4v16"></path>
              <path d="M11 4v16"></path>
              <path d="M7 4v16"></path>
              <path d="M3 4v16"></path>
            </svg>
            <span>Announcements ({announcementPosts.length})</span>
          </div>
        </TabsTrigger>
      </TabsList>
    </div>
    
    <!-- Tab Content -->
    <TabsContent value="all" class="space-y-4 mt-4">
      {#if loading}
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      {:else if posts.length === 0}
        <div class="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
          {#if searchQuery}
            <div class="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <h3 class="text-xl font-medium mb-2">No posts match your search</h3>
              <p class="text-muted-foreground">Try adjusting your search terms or clear the search</p>
              <Button variant="ghost" class="mt-4" on:click={() => { searchQuery = ''; searchPosts(); }}>
                Clear Search
              </Button>
            </div>
          {:else}
            <div class="flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
              </svg>
              <h3 class="text-xl font-medium mb-2">No posts found in this course</h3>
              <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
                Create the first post
              </Button>
            </div>
          {/if}
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4">
          {#each posts as post}
            <Card class="hover:shadow-md transition-all duration-200 border overflow-hidden">
              <div class="flex flex-col md:flex-row">
                <!-- Left side: Post metadata -->
                <div class="md:w-1/4 bg-muted/10 p-4 flex flex-row md:flex-col justify-between md:border-r">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {post.anonymous ? 'A' : getInitials(post.users?.full_name)}
                    </div>
                    <div>
                      <div class="text-sm font-medium">
                        {post.anonymous ? 'Anonymous' : post.users?.full_name || 'Unknown'} 
                        {#if !post.anonymous && post.users?.role}
                          <span class="text-xs font-normal text-muted-foreground">
                            ({post.users?.role === 'instructor' ? 'Instructor' : 
                              post.users?.role === 'ta' ? 'TA' : 'Student'})
                          </span>
                        {/if}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex flex-row md:flex-col gap-2 md:gap-3 items-end md:items-start mt-0 md:mt-4">
                    <div class="flex items-center gap-1 text-xs">
                      <div class="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>{post.response_count}</span>
                      </div>
                    </div>
                    
                    <Badge variant="outline" class="flex items-center gap-1 px-2 py-1 h-6 text-xs">
                      <span class="text-muted-foreground" innerHTML={getPostTypeIcon(post.post_type)}></span>
                      <span class="capitalize">{post.post_type}</span>
                    </Badge>
                    
                    <div class={`px-2 py-1 text-xs rounded-full border ${getStatusColor(post.status)}`}>
                      {post.status}
                    </div>
                  </div>
                </div>
                
                <!-- Right side: Post content -->
                <div class="p-4 md:p-6 flex-1">
                  <CardTitle class="mb-2 hover:text-primary transition-colors">
                    <a href="/courses/{courseId}/posts/{post.id}" class="hover:underline">
                      {post.title}
                    </a>
                  </CardTitle>
                  
                  <p class="line-clamp-3 text-muted-foreground mb-4">{post.content}</p>
                  
                  <div class="flex justify-end">
                    <Button variant="ghost" size="sm" href="/courses/{courseId}/posts/{post.id}" class="gap-1">
                      <span>View</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </TabsContent>
    
    <!-- Questions Tab -->
    <TabsContent value="questions" class="space-y-4 mt-4">
      {#if loading}
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      {:else if questionPosts.length === 0}
        <div class="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
          <div class="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <path d="M12 17h.01"></path>
            </svg>
            <h3 class="text-xl font-medium mb-2">No questions found in this course</h3>
            <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
              Ask the first question
            </Button>
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4">
          {#each questionPosts as post}
            <Card class="hover:shadow-md transition-all duration-200 border overflow-hidden">
              <div class="flex flex-col md:flex-row">
                <!-- Left side: Post metadata -->
                <div class="md:w-1/4 bg-muted/10 p-4 flex flex-row md:flex-col justify-between md:border-r">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {post.anonymous ? 'A' : getInitials(post.users?.full_name)}
                    </div>
                    <div>
                      <div class="text-sm font-medium">
                        {post.anonymous ? 'Anonymous' : post.users?.full_name || 'Unknown'} 
                        {#if !post.anonymous && post.users?.role}
                          <span class="text-xs font-normal text-muted-foreground">
                            ({post.users?.role === 'instructor' ? 'Instructor' : 
                              post.users?.role === 'ta' ? 'TA' : 'Student'})
                          </span>
                        {/if}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex flex-row md:flex-col gap-2 md:gap-3 items-end md:items-start mt-0 md:mt-4">
                    <div class="flex items-center gap-1 text-xs">
                      <div class="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>{post.response_count}</span>
                      </div>
                    </div>
                    
                    <div class={`px-2 py-1 text-xs rounded-full border ${getStatusColor(post.status)}`}>
                      {post.status}
                    </div>
                  </div>
                </div>
                
                <!-- Right side: Post content -->
                <div class="p-4 md:p-6 flex-1">
                  <CardTitle class="mb-2 hover:text-primary transition-colors">
                    <a href="/courses/{courseId}/posts/{post.id}" class="hover:underline">
                      {post.title}
                    </a>
                  </CardTitle>
                  
                  <p class="line-clamp-3 text-muted-foreground mb-4">{post.content}</p>
                  
                  <div class="flex justify-end">
                    <Button variant="ghost" size="sm" href="/courses/{courseId}/posts/{post.id}" class="gap-1">
                      <span>View</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </TabsContent>
    
    <!-- Announcements Tab -->
    <TabsContent value="announcements" class="space-y-4 mt-4">
      {#if loading}
        <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      {:else if announcementPosts.length === 0}
        <div class="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
          <div class="flex flex-col items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mb-4">
              <path d="M19 4v16"></path>
              <path d="M15 4v16"></path>
              <path d="M11 4v16"></path>
              <path d="M7 4v16"></path>
              <path d="M3 4v16"></path>
            </svg>
            <h3 class="text-xl font-medium mb-2">No announcements found in this course</h3>
            {#if course?.role === 'instructor' || course?.role === 'ta'}
              <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
                Create an announcement
              </Button>
            {/if}
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4">
          {#each announcementPosts as post}
            <Card class="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary overflow-hidden">
              <div class="flex flex-col md:flex-row">
                <!-- Left side: Post metadata -->
                <div class="md:w-1/4 bg-muted/10 p-4 flex flex-row md:flex-col justify-between md:border-r">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {getInitials(post.users?.full_name)}
                    </div>
                    <div>
                      <div class="text-sm font-medium">
                        {post.users?.full_name || 'Unknown'} 
                        {#if post.users?.role}
                          <span class="text-xs font-normal text-muted-foreground">
                            ({post.users?.role === 'instructor' ? 'Instructor' : 
                              post.users?.role === 'ta' ? 'TA' : 'Staff'})
                          </span>
                        {/if}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {formatDate(post.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </TabsContent>
  </Tabs>
{/if}
</div>

                  
