<!-- src/routes/courses/[id]/+page.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  
    const courseId = $page.params.id;
    let posts = [];
    let loading = true;
    let course = null;
    let searchQuery = '';
  
    onMount(async () => {
      // Fetch course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      course = courseData;
      
      // Fetch posts
      const { data } = await supabase
        .from('posts')
        .select(`
          id, 
          title, 
          content,
          post_type,
          status,
          created_at,
          users (full_name, role),
          (select count(*) from responses where post_id = posts.id) as response_count
        `)
        .eq('course_id', courseId)
        .eq('is_private', false)
        .order('created_at', { ascending: false });
      
      posts = data || [];
      loading = false;
    });
  
    async function searchPosts() {
      loading = true;
      
      const { data } = await supabase
        .from('posts')
        .select(`
          id, 
          title, 
          content,
          post_type,
          status,
          created_at,
          users (full_name, role),
          (select count(*) from responses where post_id = posts.id) as response_count
        `)
        .eq('course_id', courseId)
        .eq('is_private', false)
        .textSearch('search_vector', searchQuery)
        .order('created_at', { ascending: false });
      
      posts = data || [];
      loading = false;
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
      
      <Tabs defaultValue="all" class="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" class="space-y-4 mt-4">
          {#if loading}
            <p>Loading posts...</p>
          {:else if posts.length === 0}
            <p>No posts found</p>
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
                      <span class="px-2 py-1 text-xs rounded-full {post.status === 'answered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
                        {post.status}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p class="line-clamp-2">{post.content}</p>
                  <div class="mt-2 flex justify-between text-sm text-muted-foreground">
                    <span>
                      {post.anonymous ? 'Anonymous' : post.users.full_name} 
                      {post.users.role === 'instructor' ? '(Instructor)' : ''}
                    </span>
                    <span>{post.response_count} {post.response_count === 1 ? 'response' : 'responses'}</span>
                  </div>
                </CardContent>
              </Card>
            {/each}
          {/if}
        </TabsContent>
        
        <!-- Other tab contents would follow a similar pattern -->
      </Tabs>
    {:else if loading}
      <p>Loading course...</p>
    {:else}
      <p>Course not found</p>
    {/if}
  </div>