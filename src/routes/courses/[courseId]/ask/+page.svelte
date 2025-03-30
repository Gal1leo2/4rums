<!-- src/routes/courses/[courseId]/ask/+page.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase/client';
    import { user } from '$lib/stores/auth';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
    import { X, Plus, AlertCircle } from 'lucide-svelte';
  
    const courseId = $page.params.courseId;
    
    let title = '';
    let content = '';
    let postType = 'question';
    let isPrivate = false;
    let isAnonymous = false;
    let selectedFolder = '';
    let tags: string[] = [];
    let newTag = '';
    let course: any = null;
    let folders: any[] = [];
    let loading = true;
    let submitting = false;
    let error = '';
    
    onMount(async () => {
      // Check if user is authenticated
      if (!$user) {
        goto(`/auth/login?redirect=/courses/${courseId}/ask`);
        return;
      }
      
      // Load course info
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
        
      if (courseError) {
        console.error('Error loading course:', courseError);
        error = 'Could not load course information';
      } else {
        course = courseData;
      }
      
      // Load folders
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('course_id', courseId)
        .order('order');
        
      if (folderError) {
        console.error('Error loading folders:', folderError);
      } else {
        folders = folderData || [];
      }
      
      loading = false;
    });
    
    function addTag() {
      if (newTag && !tags.includes(newTag) && tags.length < 5) {
        tags = [...tags, newTag];
        newTag = '';
      }
    }
    
    function removeTag(tag: string) {
      tags = tags.filter(t => t !== tag);
    }
    
    async function submitPost() {
      if (!title.trim() || !content.trim() || !$user) {
        error = 'Please fill in all required fields';
        return;
      }
      
      submitting = true;
      error = '';
      
      // Get user's role in this course
      const { data: memberData } = await supabase
        .from('course_members')
        .select('role')
        .eq('course_id', courseId)
        .eq('user_id', $user.id)
        .single();
        
      // Only instructors and TAs can create announcements
      if (postType === 'announcement' && (!memberData || (memberData.role !== 'instructor' && memberData.role !== 'ta'))) {
        error = 'Only instructors and TAs can create announcements';
        submitting = false;
        return;
      }
      
      const { data, error: postError } = await supabase
        .from('posts')
        .insert({
          course_id: courseId,
          user_id: $user.id,
          title,
          content,
          post_type: postType,
          is_private: isPrivate,
          anonymous: isAnonymous,
          folder_id: selectedFolder || null,
          tags
        })
        .select();
        
      if (postError) {
        console.error('Error creating post:', postError);
        error = 'Failed to create post. Please try again.';
      } else if (data) {
        // Redirect to the new post
        goto(`/courses/${courseId}/posts/${data[0].id}`);
      }
      
      submitting = false;
    }
  </script>
  
  <div class="container mx-auto py-8 max-w-3xl">
    {#if loading}
      <div class="flex justify-center">
        <p>Loading...</p>
      </div>
    {:else if course}
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <a href="/courses" class="hover:underline">Courses</a>
        <span>/</span>
        <a href="/courses/{courseId}" class="hover:underline">{course.code}</a>
        <span>/</span>
        <span>New Post</span>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Post</CardTitle>
        </CardHeader>
        
        <CardContent>
          {#if error}
            <Alert variant="destructive" class="mb-4">
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          {/if}
          
          <form class="space-y-4">
            <div class="space-y-2">
              <Label for="post-type">Post Type</Label>
              <Select bind:value={postType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div class="space-y-2">
              <Label for="title">Title</Label>
              <Input id="title" placeholder="Enter a descriptive title" bind:value={title} />
            </div>
            
            <div class="space-y-2">
              <Label for="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Describe your question or post in detail..."
                rows={10}
                bind:value={content}
              />
            </div>
            
            <div class="space-y-2">
              <Label for="folder">Folder (Optional)</Label>
              <Select bind:value={selectedFolder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {#each folders as folder}
                    <SelectItem value={folder.id}>{folder.name}</SelectItem>
                  {/each}
                </SelectContent>
              </Select>
            </div>
            
            <div class="space-y-2">
              <Label>Tags (Optional)</Label>
              <div class="flex flex-wrap gap-2 mb-2">
                {#each tags as tag}
                  <div class="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-1">
                    {tag}
                    <button type="button" on:click={() => removeTag(tag)} class="text-muted-foreground">
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                {/each}
              </div>
              <div class="flex gap-2">
                <Input 
                  placeholder="Add a tag" 
                  bind:value={newTag} 
                  on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" variant="outline" on:click={addTag} disabled={tags.length >= 5}>
                  <Plus class="h-4 w-4" />
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">Add up to 5 tags</p>
            </div>
            
            <div class="flex flex-col gap-2">
              <div class="flex items-center space-x-2">
                <Checkbox id="anonymous" bind:checked={isAnonymous} />
                <Label for="anonymous">Post anonymously</Label>
              </div>
              
              <div class="flex items-center space-x-2">
                <Checkbox id="private" bind:checked={isPrivate} />
                <Label for="private">Make private (only visible to instructors/TAs)</Label>
              </div>
            </div>
          </form>
        </CardContent>
        
        <CardFooter class="flex justify-end gap-2">
          <Button variant="outline" on:click={() => goto(`/courses/${courseId}`)}>
            Cancel
          </Button>
          <Button on:click={submitPost} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Post'}
          </Button>
        </CardFooter>
      </Card>
    {:else}
      <div class="text-center py-12">
        <p>Course not found</p>
        <Button href="/courses" variant="outline" class="mt-4">
          Back to Courses
        </Button>
      </div>
    {/if}
  </div>