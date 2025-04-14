<!-- src/routes/courses/[courseId]/posts/[postId]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { Checkbox } from '$lib/components/ui/checkbox';
  
  // Define TypeScript interfaces for our data structures
  interface UserData {
    id: string;
    full_name: string;
    role?: string;
  }
  
  interface CourseData {
    id: string;
    code: string;
    name: string;
  }
  
  interface CommentData {
    id: string;
    response_id: string;
    user_id: string;
    content: string;
    anonymous: boolean;
    created_at: string;
    users?: UserData;
  }
  
  interface ResponseData {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    anonymous: boolean;
    is_endorsed: boolean;
    response_type: string;
    created_at: string;
    updated_at: string;
    user?: UserData;
    upvote_count: number;
    comments?: CommentData[];
  }
  
  interface PostData {
    id: string;
    course_id: string;
    user_id: string;
    title: string;
    content: string;
    post_type: string;
    status: string;
    anonymous: boolean;
    is_private: boolean;
    created_at: string;
    updated_at: string;
    user?: UserData;
    courses?: CourseData;
  }
  
  const { courseId, postId } = $page.params;
  
  let post: PostData | null = null;
  let responses: ResponseData[] = [];
  let newResponse: string = '';
  let isAnonymous: boolean = false;
  let loading: boolean = true;
  let submitting: boolean = false;
  let currentUserRole: string = '';
  
  onMount(async () => {
    onMount(async () => {  // Add the 'async' keyword here
  if (!$user) {
    const { data } = await supabase.auth.getSession();
      
    if (!data.session) {
      console.log("No authenticated user found, redirecting to login");
      const currentPath = window.location.pathname;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
      return; // Stop further execution
    }
  }
});
    try {
      // Load post data
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, courses(code, name)')
        .eq('id', postId)
        .single();
        
      if (postError) {
        console.error('Error loading post:', postError);
        loading = false;
        return;
      }
      
      // Get post author info
      if (!postData.anonymous) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('id', postData.user_id)
          .single();
          
        if (!userError && userData) {
          postData.user = userData;
        }
      }
      
      post = postData as PostData;
      
      // Load responses
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('post_id', postId)
        .order('is_endorsed', { ascending: false })
        .order('created_at', { ascending: true });
        
      if (responseError) {
        console.error('Error loading responses:', responseError);
      } else if (responseData) {
        // Enhance each response with user info and reactions
        const enhancedResponses = await Promise.all(responseData.map(async (response) => {
          // Get user info if not anonymous
          if (!response.anonymous) {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('id, full_name, role')
              .eq('id', response.user_id)
              .single();
              
            if (!userError && userData) {
              response.user = userData;
            }
          }
          
          // Get upvote count
          const { count: upvoteCount, error: upvoteError } = await supabase
            .from('reactions')
            .select('*', { count: 'exact', head: true })
            .eq('target_type', 'response')
            .eq('target_id', response.id)
            .eq('reaction_type', 'upvote');
            
          response.upvote_count = upvoteCount || 0;
          
          // Get comments
          const { data: comments, error: commentsError } = await supabase
            .from('comments')
            .select('*, users(id, full_name)')
            .eq('response_id', response.id)
            .order('created_at', { ascending: true });
            
          response.comments = (comments || []) as CommentData[];
          
          return response as ResponseData;
        }));
        
        responses = enhancedResponses;
      }
      
      // Get current user's role in this course
      if ($user) {
        const { data: memberData, error: memberError } = await supabase
          .from('course_members')
          .select('role')
          .eq('course_id', courseId)
          .eq('user_id', $user.id)
          .single();
          
        if (!memberError && memberData) {
          currentUserRole = memberData.role;
          
          // Set default anonymous state
          if (currentUserRole === 'student') {
            isAnonymous = true;
          }
        }
      }
      
      // Mark post as viewed
      if ($user) {
        await supabase.from('post_views').upsert({
          post_id: postId,
          user_id: $user.id,
          last_viewed_at: new Date().toISOString()
        }, { onConflict: 'post_id,user_id' });
      }
    } catch (err) {
      console.error('Error in onMount:', err);
    } finally {
      loading = false;
    }
  });
  
  async function submitResponse(): Promise<void> {
    if (!newResponse.trim() || !$user) {
      return;
    }
    
    try {
      submitting = true;
      
      const responseType = currentUserRole === 'student' 
        ? 'student_answer' 
        : 'instructor_answer';
        
      const { data, error } = await supabase
        .from('responses')
        .insert({
          post_id: postId,
          user_id: $user.id,
          content: newResponse,
          anonymous: isAnonymous,
          response_type: responseType
        })
        .select();
        
      if (error) {
        console.error('Error submitting response:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Add the new response to the list
        const newResponseData: ResponseData = {
          ...data[0],
          user: $user ? { 
            id: $user.id, 
            full_name: $user.full_name || 'User', 
            role: currentUserRole 
          } : undefined,
          upvote_count: 0,
          comments: []
        };
        
        responses = [...responses, newResponseData];
        
        // Clear the form
        newResponse = '';
        
        // Update post status if this is the first response from an instructor
        if ((responseType === 'instructor_answer' || currentUserRole === 'ta') && 
            post && post.status === 'open') {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ status: 'answered' })
            .eq('id', postId);
            
          if (!updateError && post) {
            post = { ...post, status: 'answered' };
          }
        }
      }
    } catch (err) {
      console.error('Error in submitResponse:', err);
    } finally {
      submitting = false;
    }
  }
  
  async function endorseResponse(responseId: string): Promise<void> {
    if (!$user || (currentUserRole !== 'instructor' && currentUserRole !== 'ta')) {
      return;
    }
    
    try {
      const targetResponse = responses.find(r => r.id === responseId);
      if (!targetResponse) {
        return;
      }
      
      const newEndorsedState = !targetResponse.is_endorsed;
      
      const { error } = await supabase
        .from('responses')
        .update({ is_endorsed: newEndorsedState })
        .eq('id', responseId);
        
      if (error) {
        console.error('Error endorsing response:', error);
        return;
      }
      
      // Update local state
      responses = responses.map(r => 
        r.id === responseId ? { ...r, is_endorsed: newEndorsedState } : r
      );
      
      // If we're endorsing and post is not answered, update post status
      if (newEndorsedState && post && post.status === 'open') {
        const { error: updateError } = await supabase
          .from('posts')
          .update({ status: 'answered' })
          .eq('id', postId);
          
        if (!updateError && post) {
          post = { ...post, status: 'answered' };
        }
      }
    } catch (err) {
      console.error('Error in endorseResponse:', err);
    }
  }
  
  async function upvoteResponse(responseId: string): Promise<void> {
    if (!$user) {
      return;
    }
    
    try {
      // Check if user already upvoted
      const { data: existingReaction, error: checkError } = await supabase
        .from('reactions')
        .select('id')
        .eq('user_id', $user.id)
        .eq('target_type', 'response')
        .eq('target_id', responseId)
        .eq('reaction_type', 'upvote')
        .maybeSingle();
        
      if (checkError) {
        console.error('Error checking upvote:', checkError);
        return;
      }
      
      if (existingReaction) {
        // Remove upvote
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existingReaction.id);
          
        if (deleteError) {
          console.error('Error removing upvote:', deleteError);
          return;
        }
        
        // Update local count
        responses = responses.map(r => 
          r.id === responseId ? { ...r, upvote_count: Math.max(0, r.upvote_count - 1) } : r
        );
      } else {
        // Add upvote
        const { error: insertError } = await supabase
          .from('reactions')
          .insert({
            user_id: $user.id,
            target_type: 'response',
            target_id: responseId,
            reaction_type: 'upvote'
          });
          
        if (insertError) {
          console.error('Error adding upvote:', insertError);
          return;
        }
        
        // Update local count
        responses = responses.map(r => 
          r.id === responseId ? { ...r, upvote_count: r.upvote_count + 1 } : r
        );
      }
    } catch (err) {
      console.error('Error in upvoteResponse:', err);
    }
  }
  
  function getInitials(name: string | undefined): string {
    if (!name) return 'U';
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
  {:else if post}
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <a href="/courses" class="hover:underline">Courses</a>
      <span>/</span>
      <a href="/courses/{courseId}" class="hover:underline">{post.courses?.code || 'Course'}</a>
      <span>/</span>
      <span>Question</span>
    </div>
    
    <!-- Question Card -->
    <Card class="mb-8">
      <CardHeader>
        <div class="flex justify-between items-start">
          <div>
            <Badge variant={post.post_type === 'question' ? 'default' : 'outline'} class="mb-2">
              {post.post_type}
            </Badge>
            <CardTitle class="text-2xl">{post.title}</CardTitle>
          </div>
          <Badge variant={post.status === 'answered' ? 'default' : 'secondary'}>
            {post.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div class="prose dark:prose-invert max-w-none">
          {post.content}
        </div>
      </CardContent>
      
      <CardFooter class="flex justify-between pt-4 border-t">
        <div class="flex items-center gap-2">
          <Avatar class="h-8 w-8">
            <AvatarFallback>{post.anonymous ? 'A' : getInitials(post.user?.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p class="text-sm font-medium">
              {post.anonymous ? 'Anonymous' : post.user?.full_name || 'User'}
              {post.user?.role === 'instructor' ? ' (Instructor)' : 
                post.user?.role === 'ta' ? ' (TA)' : ''}
            </p>
            <p class="text-xs text-muted-foreground">
              Posted {new Date(post.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
    
    <!-- Response Count -->
    <div class="flex items-center gap-2 mb-4">
      <h2 class="text-xl font-semibold">
        {responses.length} {responses.length === 1 ? 'Response' : 'Responses'}
      </h2>
      <Separator class="flex-1" />
    </div>
    
    <!-- Responses -->
    {#if responses.length > 0}
      <div class="space-y-4 mb-8">
        {#each responses as response (response.id)}
          <Card class={response.is_endorsed ? 'border-green-500' : ''}>
            <CardHeader class="pb-2">
              <div class="flex justify-between">
                <div class="flex items-center gap-2">
                  <Avatar class="h-8 w-8">
                    <AvatarFallback>
                      {response.anonymous ? 'A' : getInitials(response.user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p class="text-sm font-medium">
                      {response.anonymous ? 'Anonymous' : response.user?.full_name || 'User'}
                      {response.user?.role === 'instructor' ? ' (Instructor)' : 
                        response.user?.role === 'ta' ? ' (TA)' : ''}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {new Date(response.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {#if response.is_endorsed}
                  <Badge variant="default" class="flex items-center gap-1">
                    Endorsed
                  </Badge>
                {/if}
              </div>
            </CardHeader>
            
            <CardContent>
              <div class="prose dark:prose-invert max-w-none">
                {response.content}
              </div>
            </CardContent>
            
            <CardFooter class="flex justify-between pt-4 border-t">
              <div class="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  class="flex items-center gap-1"
                  onclick={() => upvoteResponse(response.id)}
                >
                  👍
                  <span>{response.upvote_count || 0}</span>
                </Button>
                
                <Button variant="ghost" size="sm" class="flex items-center gap-1">
                  💬
                  <span>{response.comments ? response.comments.length : 0}</span>
                </Button>
              </div>
              
              {#if $user && (currentUserRole === 'instructor' || currentUserRole === 'ta')}
                <Button
                  variant={response.is_endorsed ? "outline" : "ghost"}
                  size="sm"
                  onclick={() => endorseResponse(response.id)}
                >
                  {response.is_endorsed ? 'Remove Endorsement' : 'Endorse'}
                </Button>
              {/if}
            </CardFooter>
            
            {#if response.comments && response.comments.length > 0}
              <div class="px-6 pb-4">
                <Separator class="my-2" />
                <div class="space-y-2 pl-4 border-l-2 border-muted mt-2">
                  {#each response.comments as comment (comment.id)}
                    <div class="text-sm">
                      <div class="flex items-center gap-1">
                        <span class="font-medium">
                          {comment.anonymous ? 'Anonymous' : comment.users?.full_name || 'User'}:
                        </span>
                        <span class="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p>{comment.content}</p>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </Card>
        {/each}
      </div>
    {:else}
      <div class="text-center py-8 text-muted-foreground">
        <p>No responses yet. Be the first to respond!</p>
      </div>
    {/if}
    
    <!-- New Response Form -->
    {#if $user}
      <Card>
        <CardHeader>
          <CardTitle class="text-lg">Your Response</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            bind:value={newResponse}
            placeholder="Write your response here..."
            rows={5}
            disabled={submitting}
          />
          <div class="flex items-center mt-2">
            <Checkbox id="anonymous" bind:checked={isAnonymous} />
            <label for="anonymous" class="ml-2 text-sm">Post anonymously</label>
          </div>
        </CardContent>
        <CardFooter class="flex justify-end">
          <Button onclick={() => submitResponse()} disabled={submitting}>
            {submitting ? 'Posting...' : 'Post Response'}
          </Button>
        </CardFooter>
      </Card>
    {:else}
      <Card>
        <CardContent class="py-4 text-center">
          <p>Please <a href="/auth/login" class="text-primary hover:underline">sign in</a> to respond</p>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <div class="text-center py-12">
      <p>Question not found</p>
      <Button href="/courses/{courseId}" variant="outline" class="mt-4">
        Back to Course
      </Button>
    </div>
  {/if}
</div>