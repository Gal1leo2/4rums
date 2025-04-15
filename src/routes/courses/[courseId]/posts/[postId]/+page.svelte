<!-- src/routes/courses/[courseId]/posts/[postId]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Tabs from "$lib/components/ui/tabs";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  
  // Import markdown parser
  import {marked} from 'marked';
  import DOMPurify from 'dompurify';
  
  // Define TypeScript interfaces for our data structures
  interface UserData {
    id: string;
    full_name: string;
    role?: string;
    avatar_url?: string;
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
    userUpvoted?: boolean;
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
    folder_id?: string;
    folder_name?: string;
  }
  
  const { courseId, postId } = $page.params;
  
  let post: PostData | null = null;
  let responses: ResponseData[] = [];
  let newResponse: string = '';
  let commentText: string = '';
  let activeCommentId: string = '';
  let isAnonymous: boolean = false;
  let loading: boolean = true;
  let submitting: boolean = false;
  let commentSubmitting: boolean = false;
  let currentUserRole: string = '';
  let previewMode: boolean = false;
  let endorseConfirmOpen: boolean = false;
  let responseToEndorse: ResponseData | null = null;
  let sortOption: 'newest' | 'oldest' | 'endorsed' | 'upvotes' = 'newest';
  
  onMount(async () => {
    if (!$user) {
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        console.log("No authenticated user found, redirecting to login");
        const currentPath = window.location.pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        return; // Stop further execution
      }
    }

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
          .select('id, full_name, role, avatar_url')
          .eq('id', postData.user_id)
          .single();
          
        if (!userError && userData) {
          postData.user = userData;
        }
      }
      
      // Get folder info if available
      if (postData.folder_id) {
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('name')
          .eq('id', postData.folder_id)
          .single();
          
        if (!folderError && folderData) {
          postData.folder_name = folderData.name;
        }
      }
      
      post = postData as PostData;
      
      // Load responses
      const { data: responseData, error: responseError } = await supabase
        .from('responses')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });
        
      if (responseError) {
        console.error('Error loading responses:', responseError);
      } else if (responseData) {
        // Enhance each response with user info and reactions
        const enhancedResponses = await Promise.all(responseData.map(async (response) => {
          // Get user info if not anonymous
          if (!response.anonymous) {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('id, full_name, role, avatar_url')
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
          
          // Check if current user upvoted this response
          if ($user) {
            const { data: userReaction, error: userReactionError } = await supabase
              .from('reactions')
              .select('id')
              .eq('target_type', 'response')
              .eq('target_id', response.id)
              .eq('user_id', $user.id)
              .eq('reaction_type', 'upvote')
              .maybeSingle();
              
            response.userUpvoted = !!userReaction;
          }
          
          // Get comments
          const { data: comments, error: commentsError } = await supabase
            .from('comments')
            .select('*, users!comments_user_id_fkey(id, full_name, role, avatar_url)')
            .eq('response_id', response.id)
            .order('created_at', { ascending: true });
            
          if (comments) {
            response.comments = comments.map(comment => ({
              ...comment,
              users: comment.users as unknown as UserData
            })) as CommentData[];
          } else {
            response.comments = [];
          }
          
          return response as ResponseData;
        }));
        
        responses = enhancedResponses;
        sortResponses();
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
  
  function sortResponses() {
    if (sortOption === 'newest') {
      responses = [...responses].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortOption === 'oldest') {
      responses = [...responses].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else if (sortOption === 'endorsed') {
      responses = [...responses].sort((a, b) => {
        if (a.is_endorsed === b.is_endorsed) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.is_endorsed ? -1 : 1;
      });
    } else if (sortOption === 'upvotes') {
      responses = [...responses].sort((a, b) => {
        if (a.upvote_count === b.upvote_count) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.upvote_count - a.upvote_count;
      });
    }
  }
  
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
            role: currentUserRole,
            avatar_url: $user.avatar_url
          } : undefined,
          upvote_count: 0,
          comments: []
        };
        
        responses = [newResponseData, ...responses];
        
        // Clear the form
        newResponse = '';
        previewMode = false;
        
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
    // Close the confirmation dialog
    endorseConfirmOpen = false;
    
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
      
      // Re-sort if sorting by endorsement
      sortResponses();
    } catch (err) {
      console.error('Error in endorseResponse:', err);
    }
  }
  
  async function upvoteResponse(responseId: string): Promise<void> {
    if (!$user) {
      return;
    }
    
    try {
      const targetResponse = responses.find(r => r.id === responseId);
      if (!targetResponse) {
        return;
      }

      // Check if user already upvoted
      const hasUpvoted = targetResponse.userUpvoted;
        
      if (hasUpvoted) {
        // Remove upvote
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('user_id', $user.id)
          .eq('target_type', 'response')
          .eq('target_id', responseId)
          .eq('reaction_type', 'upvote');
          
        if (deleteError) {
          console.error('Error removing upvote:', deleteError);
          return;
        }
        
        // Update local state
        responses = responses.map(r => 
          r.id === responseId ? { 
            ...r, 
            upvote_count: Math.max(0, r.upvote_count - 1),
            userUpvoted: false
          } : r
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
        
        // Update local state
        responses = responses.map(r => 
          r.id === responseId ? { 
            ...r, 
            upvote_count: r.upvote_count + 1,
            userUpvoted: true
          } : r
        );
      }
      
      // Re-sort if sorting by upvotes
      if (sortOption === 'upvotes') {
        sortResponses();
      }
    } catch (err) {
      console.error('Error in upvoteResponse:', err);
    }
  }
  
  async function submitComment(responseId: string): Promise<void> {
    if (!commentText.trim() || !$user || commentSubmitting) {
      return;
    }
    
    commentSubmitting = true;
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          response_id: responseId,
          user_id: $user.id,
          content: commentText,
          anonymous: isAnonymous
        })
        .select();
        
      if (error) {
        console.error('Error submitting comment:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Add comment to local state
        const newComment: CommentData = {
          ...data[0],
          users: isAnonymous ? undefined : {
            id: $user.id,
            full_name: $user.full_name || 'User',
            role: currentUserRole,
            avatar_url: $user.avatar_url
          }
        };
        
        // Update responses
        responses = responses.map(r => {
          if (r.id === responseId) {
            return {
              ...r,
              comments: [...(r.comments || []), newComment]
            };
          }
          return r;
        });
        
        // Reset comment form
        commentText = '';
        activeCommentId = '';
      }
    } catch (err) {
      console.error('Error in submitComment:', err);
    } finally {
      commentSubmitting = false;
    }
  }
  
  function renderMarkdown(content: string): string {
    // Configure DOMPurify to allow certain tags and attributes
    const sanitizeOptions = {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
        'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
        'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img', 'span',
        'del', 'ins', 'sup', 'sub'
      ],
      ALLOWED_ATTR: [
        'href', 'name', 'target', 'src', 'alt', 'class', 'id'
      ]
    };
    
    try {
      const parsed = marked(content, {
        gfm: true,
        breaks: true,
        smartLists: true
      });
      return DOMPurify.sanitize(parsed, sanitizeOptions);
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return DOMPurify.sanitize(content);
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
  
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60 * 1000) {
      return 'just now';
    }
    
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
    
    // Regular date format
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  function getPostTypeIcon(type: string): string {
    switch (type) {
      case 'question':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <path d="M12 17h.01"></path>
        </svg>`;
      case 'announcement':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`;
      case 'note':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>`;
    }
  }
  
  function getStatusBadge(status: string): { color: string, text: string, icon: string } {
    switch (status) {
      case 'answered':
        return {
          color: 'bg-green-100 text-green-700 hover:bg-green-200',
          text: 'Answered',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`
        };
      case 'open':
        return {
          color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
          text: 'Open',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>`
        };
      case 'closed':
        return {
          color: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          text: 'Closed',
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>`
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          text: status,
          icon: ''
        };
    }
  }
</script>

<div class="container mx-auto py-8 max-w-4xl px-4 sm:px-6">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
  {:else if post}
    <!-- Breadcrumb -->
    <div class="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
      <a href="/courses" class="hover:text-primary transition-colors">Courses</a>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-1">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <a href="/courses/{courseId}" class="hover:text-primary transition-colors">{post.courses?.code || 'Course'}</a>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-1">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span class="font-medium truncate">{post.title}</span>
    </div>
    
    <!-- Question Card -->
    <!-- Question Card -->
<Card class="mb-8 overflow-hidden shadow-sm">
  <CardHeader class="pb-4 border-b bg-muted/20">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="inline-block" innerHTML={getPostTypeIcon(post.post_type)}></span>
        
        {#if post.status}
        {@const statusBadge = getStatusBadge(post.status)}
        <Badge variant="outline" class={`flex items-center gap-1 ${statusBadge.color}`}>
          <span innerHTML={statusBadge.icon}></span>
          <span>{statusBadge.text}</span>
        </Badge>
      {/if}
        
        {#if post.folder_name}
          <Badge variant="secondary" class="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>{post.folder_name}</span>
          </Badge>
        {/if}
      </div>
          
          <div class="flex gap-2">
            <a href="/courses/{courseId}" class="inline-flex">
              <Button variant="ghost" size="sm" class="h-8 gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
                <span>Back to Course</span>
              </Button>
            </a>
          </div>
        </div>
        
        <CardTitle class="text-2xl mt-2">{post.title}</CardTitle>
      </CardHeader>
      
      <CardContent class="py-6">
        <div class="flex items-center gap-3 mb-4">
          <Avatar class="h-9 w-9 border">
            {#if !post.anonymous && post.user?.avatar_url}
              <AvatarImage src={post.user.avatar_url} alt={post.user.full_name} />
            {/if}
            <AvatarFallback
              class={!post.anonymous && post.user?.role === 'instructor' 
                ? 'bg-amber-100 text-amber-700' 
                : !post.anonymous && post.user?.role === 'ta'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-muted'
              }
            >
              {post.anonymous ? 'A' : getInitials(post.user?.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <div class="text-sm font-medium flex items-center gap-1">
              <span>{post.anonymous ? 'Anonymous' : post.user?.full_name || 'User'}</span>
              {#if !post.anonymous && post.user?.role}
                <Badge variant={post.user?.role === 'instructor' ? 'default' : 
                  post.user?.role === 'ta' ? 'secondary' : 'outline'} 
                  class="px-1.5 py-0 h-4 text-[10px] font-normal"
                >
                  {post.user?.role === 'instructor' ? 'Instructor' : 
                    post.user?.role === 'ta' ? 'TA' : 'Student'}
                </Badge>
              {/if}
            </div>
            <div class="text-xs text-muted-foreground">
              {formatDate(post.created_at)}
              {#if post.updated_at && post.updated_at !== post.created_at}
                <span class="mx-1">•</span>
                <span>Edited {formatDate(post.updated_at)}</span>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="prose prose-stone dark:prose-invert max-w-none">
          {@html renderMarkdown(post.content)}
        </div>
      </CardContent>
    </Card>
    
    <!-- Responses Section -->
    <div class="mb-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h2 class="text-xl font-semibold">
          {responses.length} {responses.length === 1 ? 'Response' : 'Responses'}
        </h2>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">Sort by:</span>
          <div class="flex border rounded-md overflow-hidden">
            <button 
              type="button"
              class={`px-2.5 py-1 text-sm ${sortOption === 'newest' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'}`}
              on:click={() => {
                sortOption = 'newest';
                sortResponses();
              }}
            >
              Newest
            </button>
            <button 
              type="button"
              class={`px-2.5 py-1 text-sm ${sortOption === 'oldest' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'}`}
              on:click={() => {
                sortOption = 'oldest';
                sortResponses();
              }}
            >
              Oldest
            </button>
            <button 
              type="button"
              class={`px-2.5 py-1 text-sm ${sortOption === 'endorsed' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'}`}
              on:click={() => {
                sortOption = 'endorsed';
                sortResponses();
              }}
            >
              Endorsed
            </button>
            <button 
              type="button"
              class={`px-2.5 py-1 text-sm ${sortOption === 'upvotes' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'}`}
              on:click={() => {
                sortOption = 'upvotes';
                sortResponses();
              }}
            >
              Upvotes
            </button>
          </div>
        </div>
      </div>
      
      <!-- Responses List -->
      {#if responses.length > 0}
        <div class="space-y-4">
          {#each responses as response (response.id)}
            <Card class={response.is_endorsed ? 'border-l-4 border-l-green-500' : ''}>
              <CardHeader class="pb-3 flex flex-row justify-between items-start">
                <div class="flex items-center gap-3">
                  <Avatar class="h-9 w-9 border">
                    {#if !response.anonymous && response.user?.avatar_url}
                      <AvatarImage src={response.user.avatar_url} alt={response.user.full_name} />
                    {/if}
                    <AvatarFallback
                      class={!response.anonymous && response.user?.role === 'instructor' 
                        ? 'bg-amber-100 text-amber-700' 
                        : !response.anonymous && response.user?.role === 'ta'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-muted'
                      }
                    >
                      {response.anonymous ? 'A' : getInitials(response.user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div class="text-sm font-medium flex items-center gap-1">
                      <span>{response.anonymous ? 'Anonymous' : response.user?.full_name || 'User'}</span>
                      {#if !response.anonymous && response.user?.role}
                        <Badge variant={response.user?.role === 'instructor' ? 'default' : 
                          response.user?.role === 'ta' ? 'secondary' : 'outline'} 
                          class="px-1.5 py-0 h-4 text-[10px] font-normal"
                        >
                          {response.user?.role === 'instructor' ? 'Instructor' : 
                            response.user?.role === 'ta' ? 'TA' : 'Student'}
                        </Badge>
                      {/if}
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {formatDate(response.created_at)}
                    </p>
                  </div>
                </div>
                
                {#if response.is_endorsed}
                  <Badge variant="default" class="flex items-center gap-1 bg-green-500 text-white hover:bg-green-600 px-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m9 11-5 5 1.5 1.5L10 13"></path>
                      <path d="m19 7-8.5 8.5L7 12"></path>
                    </svg>
                    Endorsed
                  </Badge>
                {/if}
              </CardHeader>
              
              <CardContent class="pb-3">
                <div class="prose prose-stone dark:prose-invert max-w-none">
                  {@html renderMarkdown(response.content)}
                </div>
              </CardContent>
              
              <CardFooter class="flex justify-between pt-3 border-t flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <Button
                    variant={response.userUpvoted ? "default" : "outline"}
                    size="sm"
                    class={`h-8 px-3 ${response.userUpvoted ? 'bg-blue-600 hover:bg-blue-700' : 'text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'}`}
                    onclick={() => upvoteResponse(response.id)}
                  >
                    {#if response.userUpvoted}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                        <path d="m6 14 8-8 8 8"></path>
                      </svg>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                        <path d="m6 14 8-8 8 8"></path>
                      </svg>
                    {/if}
                    <span>{response.upvote_count || 0}</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    class="h-8 px-3"
                    onclick={() => {
                      if (activeCommentId === response.id) {
                        activeCommentId = '';
                      } else {
                        activeCommentId = response.id;
                        commentText = '';
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>{response.comments ? response.comments.length : 0}</span>
                  </Button>
                </div>
                
                {#if $user && (currentUserRole === 'instructor' || currentUserRole === 'ta')}
                  <Button
                    variant={response.is_endorsed ? "outline" : "ghost"}
                    size="sm"
                    class={response.is_endorsed ? 'border-green-300 text-green-700 hover:bg-green-50' : ''}
                    onclick={() => {
                      responseToEndorse = response;
                      endorseConfirmOpen = true;
                    }}
                  >
                    {#if response.is_endorsed}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                        <path d="m9 11-5 5 1.5 1.5L10 13"></path>
                        <path d="m19 7-8.5 8.5L7 12"></path>
                      </svg>
                      Remove Endorsement
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1">
                        <path d="M7 11v 8h8"></path>
                        <path d="m4 13 3-3 3 3"></path>
                        <path d="M14 6v6h4l-5 5"></path>
                      </svg>
                      Endorse
                    {/if}
                  </Button>
                {/if}
              </CardFooter>
              
              <!-- Comments Section -->
              {#if response.comments && response.comments.length > 0}
                <div class="px-6 pt-0 pb-4">
                  <Separator class="mb-3" />
                  <div class="space-y-3 ml-6 border-l-2 border-muted pl-4">
                    {#each response.comments as comment (comment.id)}
                      <div class="text-sm">
                        <div class="flex items-center gap-2 mb-1">
                          <Avatar class="h-6 w-6">
                            {#if !comment.anonymous && comment.users?.avatar_url}
                              <AvatarImage src={comment.users.avatar_url} alt={comment.users.full_name} />
                            {/if}
                            <AvatarFallback class="text-xs">
                              {comment.anonymous ? 'A' : getInitials(comment.users?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span class="font-medium">
                            {comment.anonymous ? 'Anonymous' : comment.users?.full_name || 'User'}
                          </span>
                          <span class="text-xs text-muted-foreground">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <div class="pl-8">
                          <p class="text-muted-foreground">{comment.content}</p>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              
              <!-- Comment Form -->
              {#if $user && activeCommentId === response.id}
                <div class="px-6 pb-4 pt-0">
                  <Separator class="mb-3" />
                  <div class="ml-6 border-l-2 border-muted pl-4">
                    <div class="mb-2 text-sm font-medium">Add a comment</div>
                    <div class="flex gap-2">
                      <Textarea 
                        bind:value={commentText} 
                        placeholder="Write your comment..." 
                        rows={2} 
                        class="text-sm resize-none"
                        disabled={commentSubmitting}
                      />
                    </div>
                    <div class="flex items-center justify-between mt-2">
                      <div class="flex items-center">
                        <Checkbox id={`anon-comment-${response.id}`} bind:checked={isAnonymous} />
                        <label for={`anon-comment-${response.id}`} class="ml-2 text-xs">Post anonymously</label>
                      </div>
                      <div class="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onclick={() => {
                            activeCommentId = '';
                            commentText = '';
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          disabled={!commentText.trim() || commentSubmitting}
                          onclick={() => submitComment(response.id)}
                        >
                          {commentSubmitting ? 'Posting...' : 'Post Comment'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </Card>
          {/each}
        </div>
      {:else}
        <Card class="bg-muted/5">
          <div class="text-center py-10 px-4">
            <div class="mx-auto size-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-1">No responses yet</h3>
            <p class="text-muted-foreground max-w-md mx-auto mb-6">Be the first to respond to this {post.post_type}!</p>
          </div>
        </Card>
      {/if}
    </div>
    
    <!-- New Response Form -->
    {#if $user}
      <Card id="respond">
        <CardHeader class="pb-3">
          <CardTitle class="text-lg">Your Response</CardTitle>
          <CardDescription>Respond to this {post.post_type}. You can use Markdown for formatting.</CardDescription>
        </CardHeader>
        
        <!-- Editor Tabs -->
        <div class="px-6">
          <Tabs.Root value={previewMode ? "preview" : "write"}>
            <Tabs.List class="w-full">
              <Tabs.Trigger 
                value="write" 
                class="flex-1" 
                onclick={() => previewMode = false}
              >
                Write
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="preview" 
                class="flex-1" 
                onclick={() => previewMode = true}
              >
                Preview
              </Tabs.Trigger>
            </Tabs.List>
            
            <Tabs.Content value="write" class="pt-4 focus-visible:outline-none focus-visible:ring-0">
              <Textarea
                bind:value={newResponse}
                placeholder="Write your response here... You can use Markdown for formatting"
                rows={6}
                class="resize-y min-h-[150px]"
                disabled={submitting}
              />
            </Tabs.Content>
            
            <Tabs.Content value="preview" class="pt-4 focus-visible:outline-none focus-visible:ring-0">
              {#if newResponse.trim()}
                <div class="border rounded-md p-4 min-h-[150px] prose prose-stone dark:prose-invert max-w-none">
                  {@html renderMarkdown(newResponse)}
                </div>
              {:else}
                <div class="border rounded-md p-4 min-h-[150px] flex items-center justify-center text-muted-foreground">
                  <p>Nothing to preview</p>
                </div>
              {/if}
            </Tabs.Content>
          </Tabs.Root>
        </div>
        
        <CardFooter class="flex justify-between items-center pt-5 mt-4 border-t">
          <div class="flex items-center">
            <Checkbox id="anonymous" bind:checked={isAnonymous} />
            <label for="anonymous" class="ml-2 text-sm">Post anonymously</label>
          </div>
          
          <Button 
            variant="default"
            class="gap-1"
            onclick={() => submitResponse()}
            disabled={!newResponse.trim() || submitting}
          >
            {#if submitting}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Posting...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 3a14.05 14.05 0 0 1-2.8 4.2c-2 2-5.3 2.8-7.2 3V7H9v3.2c-1.9-.2-5.2-1-7.2-3A14.05 14.05 0 0 1-.033 3"></path>
                <path d="M16 10v10M12 22l4-4 4 4M8 10v10M8 18l-4 4-4-4"></path>
              </svg>
              <span>Post Response</span>
            {/if}
          </Button>
        </CardFooter>
      </Card>
    {:else}
      <Card>
        <CardContent class="py-8 text-center">
          <div class="mx-auto size-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h3 class="text-lg font-medium mb-2">Sign in to respond</h3>
          <p class="text-muted-foreground mb-4 max-w-md mx-auto">Join the discussion by signing in to your account</p>
          <a href={`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`}>
            <Button variant="default">
              Sign In
            </Button>
          </a>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <!-- Not Found State -->
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="size-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      <h2 class="text-2xl font-semibold mb-2">Post Not Found</h2>
      <p class="text-muted-foreground mb-6 max-w-md">The post you're looking for may have been removed or you don't have permission to view it.</p>
      <a href="/courses/{courseId}">
        <Button variant="outline">
          Back to Course
        </Button>
      </a>
    </div>
  {/if}
</div>

<!-- Endorsement confirmation dialog -->
<AlertDialog.Root open={endorseConfirmOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {responseToEndorse?.is_endorsed ? 'Remove Endorsement?' : 'Endorse Response?'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {#if responseToEndorse?.is_endorsed}
          Are you sure you want to remove your endorsement from this response?
        {:else}
          Endorsing indicates this response correctly addresses the question. This may mark the post as answered.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => endorseConfirmOpen = false}>
        Cancel
      </AlertDialog.Cancel>
      <AlertDialog.Action 
        onclick={() => {
          if (responseToEndorse) {
            endorseResponse(responseToEndorse.id);
          }
        }}
      >
        {responseToEndorse?.is_endorsed ? 'Remove Endorsement' : 'Endorse'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>