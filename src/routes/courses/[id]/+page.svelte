<!-- src/routes/courses/[id]/+page.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { Badge } from '$lib/components/ui/badge';
  
    const courseId = $page.params.id;
    let posts = [];
    let allPosts = [];
    let questionPosts = [];
    let announcementPosts = [];
    let loading = true;
    let course = null;
    let searchQuery = '';
  
    // Fix the query to avoid nested subquery issues
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
      // This is more efficient than trying to do it all in one complex query
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
      
      // Unfortunately, we can't use textSearch with complex queries
      // So we'll do a client-side search for now
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
  </script>
  
  <div class="container mx-auto py-8">
    {#if course}
      <h1 class="text-3xl font-bold mb-6">{course.code}: {course.name}</h1>
    
      <div class="flex justify-between items-center mb-6">
        <form on:submit|preventDefault={searchPosts} class="flex gap-2 w-full max-w-lg">
          <Input placeholder="Search questions..." bind:value={searchQuery} />
          <Button type="submit">Search</Button>
        </form>
        
        <Button href="/courses/{courseId}/ask" variant="default">
          Ask a Question
        </Button>
      </div>
      
      <Tabs defaultValue="all" class="w-full" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All ({allPosts.length})</TabsTrigger>
          <TabsTrigger value="questions">Questions ({questionPosts.length})</TabsTrigger>
          <TabsTrigger value="announcements">Announcements ({announcementPosts.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" class="space-y-4 mt-4">
          {#if loading}
            <div class="flex justify-center py-6">
              <p>Loading posts...</p>
            </div>
          {:else if posts.length === 0}
            <div class="text-center py-12 text-muted-foreground">
              <p>{searchQuery ? 'No posts match your search' : 'No posts found in this course'}</p>
              <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
                Create the first post
              </Button>
            </div>
          {:else}
            {#each posts as post}
              <Card>
                <CardHeader>
                  <div class="flex justify-between">
                    <CardTitle>
                      <a href="/courses/{courseId}/posts/{post.id}" class="hover:underline">
                        {post.title}
                      </a>
                    </CardTitle>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant={post.status === 'answered' ? 'success' : 'secondary'}>
                        {post.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="mb-4">
                    <Badge variant="outline">{post.post_type}</Badge>
                  </div>
                  <p class="line-clamp-2 mb-4">{post.content}</p>
                  <div class="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {post.anonymous ? 'Anonymous' : post.users.full_name} 
                      {post.users?.role === 'instructor' ? ' (Instructor)' : 
                        post.users?.role === 'ta' ? ' (TA)' : ''}
                    </span>
                    <span>{post.response_count} {post.response_count === 1 ? 'response' : 'responses'}</span>
                  </div>
                </CardContent>
              </Card>
            {/each}
          {/if}
        </TabsContent>
        
        <TabsContent value="questions" class="space-y-4 mt-4">
          {#if loading}
            <div class="flex justify-center py-6">
              <p>Loading questions...</p>
            </div>
          {:else if questionPosts.length === 0}
            <div class="text-center py-12 text-muted-foreground">
              <p>No questions found in this course</p>
              <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
                Ask the first question
              </Button>
            </div>
          {:else}
            {#each questionPosts as post}
              <Card>
                <CardHeader>
                  <div class="flex justify-between">
                    <CardTitle>
                      <a href="/courses/{courseId}/posts/{post.id}" class="hover:underline">
                        {post.title}
                      </a>
                    </CardTitle>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant={post.status === 'answered' ? 'success' : 'secondary'}>
                        {post.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p class="line-clamp-2 mb-4">{post.content}</p>
                  <div class="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {post.anonymous ? 'Anonymous' : post.users.full_name} 
                      {post.users?.role === 'instructor' ? ' (Instructor)' : 
                        post.users?.role === 'ta' ? ' (TA)' : ''}
                    </span>
                    <span>{post.response_count} {post.response_count === 1 ? 'response' : 'responses'}</span>
                  </div>
                </CardContent>
              </Card>
            {/each}
          {/if}
        </TabsContent>
        
        <TabsContent value="announcements" class="space-y-4 mt-4">
          {#if loading}
            <div class="flex justify-center py-6">
              <p>Loading announcements...</p>
            </div>
          {:else if announcementPosts.length === 0}
            <div class="text-center py-12 text-muted-foreground">
              <p>No announcements found in this course</p>
              {#if course?.role === 'instructor' || course?.role === 'ta'}
                <Button href="/courses/{courseId}/ask" variant="outline" class="mt-4">
                  Create an announcement
                </Button>
              {/if}
            </div>
          {:else}
            {#each announcementPosts as post}
              <Card>
                <CardHeader>
                  <div class="flex justify-between">
                    <CardTitle>
                      <a href="/courses/{courseId}/posts/{post.id}" class="hover:underline">
                        {post.title}
                      </a>
                    </CardTitle>
                    <div class="flex items-center gap-2">
                      <span class="text-sm text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <Badge variant="outline">Announcement</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p class="line-clamp-3 mb-4">{post.content}</p>
                  <div class="text-sm text-muted-foreground">
                    <span>
                      {post.users?.full_name || 'Unknown'} 
                      {post.users?.role === 'instructor' ? ' (Instructor)' : 
                        post.users?.role === 'ta' ? ' (TA)' : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            {/each}
          {/if}
        </TabsContent>
      </Tabs>
    {:else if loading}
      <div class="flex justify-center py-12">
        <p>Loading course...</p>
      </div>
    {:else}
      <div class="text-center py-12">
        <p>Course not found</p>
        <Button href="/courses" variant="outline" class="mt-4">
          Back to Courses
        </Button>
      </div>
    {/if}
  </div>