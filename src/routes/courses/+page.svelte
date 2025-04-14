<!-- src/routes/courses/[id]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase/client';
  import { user } from '$lib/stores/auth';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import * as Accordion from '$lib/components/ui/accordion';
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar';
  
  // Import markdown parser library
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  // TypeScript interfaces
  interface CourseData {
    id: string;
    code: string;
    name: string;
    term: string;
    description?: string;
    is_active: boolean;
  }

  interface UserData {
    id: string;
    full_name: string;
    role?: string;
  }

  interface FolderData {
    id: string;
    name: string;
    order: number;
    posts?: PostData[];
  }

  interface PostData {
    id: string;
    title: string;
    content: string;
    post_type: 'question' | 'announcement' | 'note';
    status: 'open' | 'answered' | 'closed';
    created_at: string;
    anonymous: boolean;
    user_id: string;
    folder_id?: string;
    users?: UserData;
    response_count: number;
  }

  const courseId = $page.params.id;
  
  let posts: PostData[] = [];
  let allPosts: PostData[] = [];
  let questionPosts: PostData[] = [];
  let announcementPosts: PostData[] = [];
  let folders: FolderData[] = [];
  let loading: boolean = true;
  let course: CourseData | null = null;
  let searchQuery: string = '';
  let userRole: string = '';
  let currentTab: string = 'all';
  let currentFolder: string | null = null;

  // Function to load course and posts data
  async function loadCourseAndPosts(): Promise<void> {
    try {
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
      
      course = courseData as CourseData;
      
      // Get user's role in this course if logged in
      if ($user) {
        const { data: memberData, error: memberError } = await supabase
          .from('course_members')
          .select('role')
          .eq('course_id', courseId)
          .eq('user_id', $user.id)
          .single();
          
        if (!memberError && memberData) {
          userRole = memberData.role;
        }
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
        folders = (folderData || []) as FolderData[];
      }
      
      // Fetch posts with simplified query
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
          user_id,
          folder_id
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
      const enhancedPosts = await Promise.all((postsData || []).map(async (post) => {
        // Get user info
        let userInfo: UserData = { id: '', full_name: 'Unknown', role: 'student' };
        
        if (!post.anonymous) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name, role')
            .eq('id', post.user_id)
            .single();
          
          if (!userError && userData) {
            userInfo = {
              id: post.user_id,
              full_name: userData.full_name,
              role: userData.role
            };
          }
        }
        
        // Get response count
        const { count: responseCount, error: countError } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        
        return {
          ...post,
          users: userInfo,
          response_count: responseCount || 0
        } as PostData;
      }));
      
      allPosts = enhancedPosts;
      questionPosts = enhancedPosts.filter(post => post.post_type === 'question');
      announcementPosts = enhancedPosts.filter(post => post.post_type === 'announcement');
      
      // Group posts by folder
      folders = folders.map(folder => {
        const folderPosts = enhancedPosts.filter(post => post.folder_id === folder.id);
        return {
          ...folder,
          posts: folderPosts
        };
      });
      
      // Add an "Uncategorized" virtual folder for posts without a folder
      const uncategorizedPosts = enhancedPosts.filter(post => !post.folder_id);
      if (uncategorizedPosts.length > 0) {
        folders.push({
          id: 'uncategorized',
          name: 'Uncategorized',
          order: 9999,
          posts: uncategorizedPosts
        });
      }
      
      posts = allPosts;
    } catch (err) {
      console.error('Error in loadCourseAndPosts:', err);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    // Authentication guard
    if (!$user) {
      const { data } = await supabase.auth.getSession();
        
      if (!data.session) {
        console.log("No authenticated user found, redirecting to login");
        const currentPath = window.location.pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        return; // Stop further execution
      }
    }

    await loadCourseAndPosts();
  });

  async function searchPosts(): Promise<void> {
    loading = true;
    
    // Client-side search when search query is provided
    if (searchQuery.trim() === '') {
      setCurrentView(currentTab, currentFolder);
      loading = false;
      return;
    }
    
    const query = searchQuery.toLowerCase();
    let filtered = allPosts.filter(post => 
      post.title.toLowerCase().includes(query) || 
      post.content.toLowerCase().includes(query)
    );
    
    // Additional filtering based on tab
    if (currentTab === 'questions') {
      filtered = filtered.filter(post => post.post_type === 'question');
    } else if (currentTab === 'announcements') {
      filtered = filtered.filter(post => post.post_type === 'announcement');
    }
    
    // Additional filtering based on folder
    if (currentFolder) {
      filtered = filtered.filter(post => post.folder_id === currentFolder);
    }
    
    posts = filtered;
    loading = false;
  }
  
  function handleTabChange(tabValue: string): void {
    currentTab = tabValue;
    setCurrentView(tabValue, currentFolder);
  }
  
  function handleFolderChange(folderId: string | null): void {
    currentFolder = folderId;
    setCurrentView(currentTab, folderId);
  }
  
  function setCurrentView(tab: string, folderId: string | null): void {
    let filteredPosts = allPosts;
    
    // First filter by tab
    if (tab === 'questions') {
      filteredPosts = questionPosts;
    } else if (tab === 'announcements') {
      filteredPosts = announcementPosts;
    }
    
    // Then filter by folder if a folder is selected
    if (folderId) {
      filteredPosts = filteredPosts.filter(post => 
        folderId === 'uncategorized' 
          ? !post.folder_id 
          : post.folder_id === folderId
      );
    }
    
    posts = filteredPosts;
  }
  
  // Function to get appropriate status color
  function getStatusColor(status: string): string {
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
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
  
  // Generate initials from name
  function getInitials(name: string | undefined): string {
    if (!name || name === 'Unknown') return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }
  
  // Get post type icon
  function getPostTypeIcon(type: string): string {
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
  
  // Get folder icon
  function getFolderIcon(name: string): string {
    // Generate consistent color based on folder name
    const hashCode = name.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = [
      'text-blue-500',
      'text-green-500',
      'text-purple-500',
      'text-amber-500',
      'text-rose-500',
      'text-indigo-500',
      'text-emerald-500',
      'text-pink-500'
    ];
    
    const colorClass = colors[Math.abs(hashCode) % colors.length];
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${colorClass}">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-9l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>
    </svg>`;
  }
  
  // Render markdown content preview
  function renderMarkdownPreview(content: string): string {
    // Limit content length for preview
    const previewContent = content.length > 300 
      ? content.substring(0, 300) + '...' 
      : content;
      
    // Parse markdown and sanitize HTML
    return DOMPurify.sanitize(marked.parse(previewContent));
  }
  
  // Count posts in folder
  function countPostsInFolder(folderId: string): number {
    if (folderId === 'uncategorized') {
      return allPosts.filter(post => !post.folder_id).length;
    }
    return allPosts.filter(post => post.folder_id === folderId).length;
  }
  
  function handleSearch(e: Event): void {
    e.preventDefault();
    searchPosts();
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
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="outline" class="text-sm px-3">
              <span class="mr-1">{course.term.includes('Fall') ? '🍂' : course.term.includes('Spring') ? '🌱' : course.term.includes('Summer') ? '☀️' : course.term.includes('Winter') ? '❄️' : '📚'}</span>
              {course.term}
            </Badge>
            {#if userRole}
              <Badge variant="secondary" class="text-sm px-3 capitalize">{userRole}</Badge>
            {/if}
            {#if course.is_active}
              <Badge variant="default" class="bg-green-500 text-white hover:bg-green-600">Active</Badge>
            {:else}
              <Badge variant="outline" class="text-muted-foreground">Archived</Badge>
            {/if}
          </div>
        </div>
        
        <div class="flex gap-2">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" class="gap-2" size="sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 16V8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z"></path>
                  <path d="M10 10a2 2 0 1 1 4 0v6"></path>
                  <path d="M10 16h4"></path>
                </svg>
                <span>New</span>
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-48">
              <DropdownMenu.Item href="/courses/{courseId}/ask?type=question" class="gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <path d="M12 17h.01"></path>
                </svg>
                <span>Ask Question</span>
              </DropdownMenu.Item>
              {#if userRole === 'instructor' || userRole === 'ta'}
                <DropdownMenu.Item href="/courses/{courseId}/ask?type=announcement" class="gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 4v16"></path>
                    <path d="M15 4v16"></path>
                    <path d="M11 4v16"></path>
                    <path d="M7 4v16"></path>
                    <path d="M3 4v16"></path>
                  </svg>
                  <span>Announcement</span>
                </DropdownMenu.Item>
              {/if}
              <DropdownMenu.Item href="/courses/{courseId}/ask?type=note" class="gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span>Create Note</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
      
      {#if course.description}
        <div class="mt-4 p-4 bg-muted/20 rounded-lg border border-muted">
          <p class="text-muted-foreground">{course.description}</p>
        </div>
      {/if}
    </div>
    
    <div class="grid grid-cols-12 gap-6">
      <!-- Sidebar - Folders -->
      <div class="col-span-12 md:col-span-3 space-y-6">
        <!-- Search -->
        <div>
          <form on:submit|preventDefault={handleSearch} class="flex gap-2 w-full">
            <div class="relative flex-1">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
              </div>
              <Input placeholder="Search..." bind:value={searchQuery} class="pl-10" />
            </div>
            <Button type="submit" variant="default" size="icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 22-6-6"></path>
                <circle cx="11" cy="11" r="8"></circle>
              </svg>
            </Button>
          </form>
        </div>
        
        <!-- Filters -->
        <div class="bg-card border rounded-lg overflow-hidden">
          <div class="p-4 border-b bg-muted/30">
            <h3 class="font-medium text-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
              </svg>
              Filters
            </h3>
          </div>
          <div class="p-2">
            <Button 
              variant={currentTab === 'all' && !currentFolder ? "default" : "ghost"} 
              size="sm"
              class="w-full justify-start gap-2 mb-1"
              onclick={() => {
                handleTabChange('all');
                handleFolderChange(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
              </svg>
              <span>All Posts</span>
              <span class="ml-auto bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">
                {allPosts.length}
              </span>
            </Button>
            
            <Button 
              variant={currentTab === 'questions' && !currentFolder ? "default" : "ghost"} 
              size="sm"
              class="w-full justify-start gap-2 mb-1"
              onclick={() => {
                handleTabChange('questions');
                handleFolderChange(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <path d="M12 17h.01"></path>
              </svg>
              <span>Questions</span>
              <span class="ml-auto bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">
                {questionPosts.length}
              </span>
            </Button>
            
            <Button 
              variant={currentTab === 'announcements' && !currentFolder ? "default" : "ghost"} 
              size="sm"
              class="w-full justify-start gap-2"
              onclick={() => {
                handleTabChange('announcements');
                handleFolderChange(null);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 4v16"></path>
                <path d="M15 4v16"></path>
                <path d="M11 4v16"></path>
                <path d="M7 4v16"></path>
                <path d="M3 4v16"></path>
              </svg>
              <span>Announcements</span>
              <span class="ml-auto bg-muted text-muted-foreground text-xs rounded-full px-2 py-0.5">
                {announcementPosts.length}
              </span>
            </Button>
          </div>
        </div>
        
        <!-- Folders -->
        {#if folders.length > 0}
          <div class="bg-card border rounded-lg overflow-hidden">
            <div class="p-4 border-b bg-muted/30">
              <h3 class="font-medium text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-9l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>
                </svg>
                Folders
              </h3>
            </div>
            <div class="p-2">
              <Accordion.Root collapsible>
                {#each folders as folder (folder.id)}
                  <Accordion.Item value={folder.id} class="border-0">
                    <Accordion.Trigger
                      class={`flex justify-between items-center w-full p-2.5 text-sm font-medium rounded-md ${currentFolder === folder.id ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent/50'}`}
                      onclick={() => handleFolderChange(folder.id)}
                    >
                      <div class="flex items-center gap-2">
                        <span innerHTML={getFolderIcon(folder.name)}></span>
                        <span>{folder.name}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="bg-muted/50 text-muted-foreground text-xs rounded-full px-2 py-0.5">
                          {countPostsInFolder(folder.id)}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="data-[state=open]:rotate-180 transition-transform duration-200">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </Accordion.Trigger>
                    <Accordion.Content class="pt-1 pb-2 px-2">
                      <div class="pl-6 border-l border-muted space-y-1 mt-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          class="w-full justify-start gap-2"
                          onclick={() => {
                            handleTabChange('all');
                            handleFolderChange(folder.id);
                          }}
                        >
                          <span>All Types</span>
                        </Button>
                        
                        {#if (folder.posts || []).some(post => post.post_type === 'announcement')}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            class="w-full justify-start gap-2"
                            onclick={() => {
                              handleTabChange('announcements');
                              handleFolderChange(folder.id);
                            }}
                          >
                            <span>Announcements Only</span>
                          </Button>
                        {/if}
                        
                        {#if (folder.posts || []).some(post => post.post_type === 'note')}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            class="w-full justify-start gap-2"
                            onclick={() => {
                              handleTabChange('notes');
                              handleFolderChange(folder.id);
                            }}
                          >
                            <span>Notes Only</span>
                          </Button>
                        {/if}
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                {/each}
              </Accordion.Root>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Main Content -->
      <div class="col-span-12 md:col-span-9">
        <!-- Post list -->
        <Card>
          <CardHeader class="pb-3">
            <div class="flex justify-between items-center">
              <CardTitle class="text-xl">
                {#if currentFolder}
                  {folders.find(f => f.id === currentFolder)?.name || 'Posts'}
                {:else if currentTab === 'questions'}
                  Questions
                {:else if currentTab === 'announcements'}
                  Announcements
                {:else}
                  All Posts
                {/if}
              </CardTitle>
              
              {#if searchQuery}
                <Badge variant="outline" class="flex gap-1 px-3 py-1">
                  <span>Search: {searchQuery}</span>
                  <button 
                    class="opacity-70 hover:opacity-100"
                    onclick={() => { 
                      searchQuery = ''; 
                      setCurrentView(currentTab, currentFolder); 
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 6 6 18"></path>
                      <path d="m6 6 12 12"></path>
                    </svg>
                  </button>
                </Badge>
              {/if}
            </div>
          </CardHeader>
          
          <CardContent class="p-0">
            {#if loading}
              <div class="flex justify-center py-12">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              </div>
            {:else if posts.length === 0}
              <div class="text-center py-16 bg-muted/20 rounded-md">
                <div class="flex flex-col items-center">
                  <div class="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
                      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"></path>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                      <path d="M16 19h6"></path>
                      <path d="M19 16v6"></path>
                    </svg>
                  </div>
                  
                  {#if searchQuery}
                    <h3 class="text-xl font-medium mb-2">No posts match your search</h3>
                    <p class="text-muted-foreground max-w-sm mx-auto">Try adjusting your search terms or clear the search</p>
                    <Button variant="outline" class="mt-4" onclick={() => { searchQuery = ''; setCurrentView(currentTab, currentFolder); }}>
                      Clear Search
                    </Button>
                  {:else if currentFolder}
                    <h3 class="text-xl font-medium mb-2">No posts in this folder</h3>
                    <p class="text-muted-foreground max-w-sm mx-auto">Try selecting a different folder or create a new post</p>
                    <div class="flex gap-2 mt-4">
                      <Button variant="outline" onclick={() => handleFolderChange(null)}>
                        View All Posts
                      </Button>
                      <Button href="/courses/{courseId}/ask">
                        Create Post
                      </Button>
                    </div>
                  {:else}
                    <h3 class="text-xl font-medium mb-2">No posts found</h3>
                    <p class="text-muted-foreground max-w-sm mx-auto">Be the first to create a post in this course</p>
                    <Button href="/courses/{courseId}/ask" class="mt-4">
                      Create Post
                    </Button>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="divide-y">
                {#each posts as post}
                  <div class="p-4 md:p-6 flex flex-col md:flex-row gap-4 hover:bg-muted/5 transition-colors">
                    <!-- Post metadata (left side) -->
                    <div class="md:w-44 flex flex-row md:flex-col justify-between">
                      <div class="flex items-center gap-2">
                        <Avatar class="h-8 w-8">
                          <AvatarFallback class="bg-primary/10 text-primary">
                            {post.anonymous ? 'A' : getInitials(post.users?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div class="text-sm font-medium truncate">
                            {post.anonymous ? 'Anonymous' : post.users?.full_name || 'Unknown'}
                          </div>
                          <div class="text-xs text-muted-foreground">
                            {formatDate(post.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex md:flex-col gap-2 md:mt-3 items-end md:items-start">
                        <div class="flex items-center gap-1 bg-muted/30 px-2 py-1 rounded text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M7 9h10M7 4h6" />
                            <path d="M7 14h2" />
                            <path d="M15 14h2" />
                            <rect x="3" y="2" width="18" height="20" rx="2" />
                          </svg>
                          <span>{post.response_count}</span>
                        </div>
                        
                        <Badge variant={post.post_type === 'announcement' ? 'secondary' : 'outline'} class="flex items-center gap-1 h-6">
                          <span class="text-xs" innerHTML={getPostTypeIcon(post.post_type)}></span>
                          <span class="capitalize text-xs">{post.post_type}</span>
                        </Badge>
                        
                        {#if post.post_type === 'question'}
                          <div class={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(post.status)}`}>
                            {post.status}
                          </div>
                        {/if}
                      </div>
                    </div>
                    
                    <!-- Post content (right side) -->
                    <div class="flex-1 overflow-hidden">
                      <a href="/courses/{courseId}/posts/{post.id}" class="block group">
                        <h3 class="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </h3>
                        
                        <div class="prose prose-sm max-w-none text-muted-foreground line-clamp-3 mb-4">
                          {@html renderMarkdownPreview(post.content)}
                        </div>
                      </a>
                      
                      <div class="flex items-center justify-between mt-auto">
                        {#if post.folder_id && post.folder_id !== 'uncategorized'}
                          <Badge variant="outline" class="text-xs">
                            <span class="mr-1" innerHTML={getFolderIcon(folders.find(f => f.id === post.folder_id)?.name || 'Folder')}></span>
                            {folders.find(f => f.id === post.folder_id)?.name || 'Folder'}
                          </Badge>
                        {:else}
                          <div></div>
                        {/if}
                        
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
                {/each}
              </div>
            {/if}
          </CardContent>
        </Card>
      </div>
    </div>
  {:else if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
  {:else}
    <!-- Course not found state -->
    <div class="text-center py-12">
      <div class="flex flex-col items-center">
        <div class="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-semibold mb-2">Course Not Found</h2>
        <p class="text-muted-foreground mb-6">The course you're looking for doesn't exist or you don't have access to it.</p>
        <Button href="/courses" variant="outline">Back to Courses</Button>
      </div>
    </div>
  {/if}
</div> post.post_type === 'question')}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            class="w-full justify-start gap-2"
                            onclick={() => {
                              handleTabChange('questions');
                              handleFolderChange(folder.id);
                            }}
                          >
                            <span>Questions Only</span>
                          </Button>
                        {/if}
                        
                        {#if (folder.posts || []).some(post =>