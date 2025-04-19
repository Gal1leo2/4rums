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
	import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tabs from '$lib/components/ui/tabs';
	import { 
		X, 
		Plus, 
		AlertCircle, 
		HelpCircle, 
		Megaphone, 
		FileText,
		Folder, 
		Tag, 
		Eye, 
		EyeOff, 
		Send,
		UserCheck
	} from 'lucide-svelte';

	// TypeScript interfaces
	interface Course {
		id: string;
		code: string;
		name: string;
		term: string;
		description?: string;
		is_active: boolean;
	}

	interface Folder {
		id: string;
		course_id: string;
		name: string;
		order: number;
	}

	const courseId = $page.params.courseId;

	let title: string = '';
	let content: string = '';
	let postType: 'question' | 'announcement' | 'note' = 'question';
	let isPrivate: boolean = false;
	let isAnonymous: boolean = false;
	let selectedFolder: string = '';
	let tags: string[] = [];
	let newTag: string = '';
	let course: Course | null = null;
	let folders: Folder[] = [];
	let loading: boolean = true;
	let submitting: boolean = false;
	let error: string = '';
	let userRole: string = '';
	let previewMode: boolean = false;
	
	// Set initial post type from URL query parameter
	onMount(async () => {
		// Check for post type in URL
		const urlParams = new URLSearchParams(window.location.search);
		const typeParam = urlParams.get('type');
		
		if (typeParam === 'announcement' || typeParam === 'note' || typeParam === 'question') {
			postType = typeParam;
		}
		
		// Authentication guard
		if (!$user) {
			const { data } = await supabase.auth.getSession();

			if (!data.session) {
				console.log('No authenticated user found, redirecting to login');
				const currentPath = window.location.pathname;
				window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
				return; // Stop further execution
			}
		}

		// Load course data and user role
		await loadCourseData();
		
		// Set up connection monitoring
		const pingInterval = setInterval(async () => {
			try {
				// Simple lightweight ping to keep the connection warm
				await supabase.from('posts').select('count', { count: 'exact', head: true }).limit(1);
				console.log('Connection active');
			} catch (e) {
				console.warn('Connection issue detected:', e);
			}
		}, 5000); // Every 5 seconds

		// Clean up the interval when component is destroyed
		return () => {
			if (pingInterval) clearInterval(pingInterval);
		};
	});
	
	async function loadCourseData(): Promise<void> {
		try {
			// Load course info
			const { data: courseData, error: courseError } = await supabase
				.from('courses')
				.select('*')
				.eq('id', courseId)
				.single();

			if (courseError) {
				console.error('Error loading course:', courseError);
				error = 'Could not load course information';
				loading = false;
				return;
			}

			course = courseData as Course;

			// Load folders
			const { data: folderData, error: folderError } = await supabase
				.from('folders')
				.select('*')
				.eq('course_id', courseId)
				.order('order');

			if (folderError) {
				console.error('Error loading folders:', folderError);
			} else {
				folders = (folderData as Folder[]) || [];
			}

			// Get user's role in this course - FIXED: Improved role fetching
			if ($user) {
				console.log('Checking role for user:', $user.id);
				const { data: memberData, error: memberError } = await supabase
					.from('course_members')
					.select('role')
					.eq('course_id', courseId)
					.eq('user_id', $user.id)
					.single();

				if (memberError) {
					console.error('Error fetching user role:', memberError);
					error = 'You do not have permission to post in this course';
				} else if (memberData) {
					userRole = memberData.role;
					console.log('User role fetched successfully:', userRole);

					// Set isAnonymous default based on role
					if (userRole === 'student') {
						isAnonymous = true;
					}
					
					// Reset the post type if not allowed to create announcements
					if (postType === 'announcement' && userRole !== 'instructor' && userRole !== 'ta') {
						postType = 'question';
						console.log('Reset post type to question due to insufficient permissions');
					}
				} else {
					console.log('No role data found for this user in this course');
					error = 'You are not enrolled in this course';
				}
			}
		} catch (err) {
			console.error('Unexpected error loading course data:', err);
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	function addTag(): void {
		if (newTag && !tags.includes(newTag) && tags.length < 5) {
			tags = [...tags, newTag];
			newTag = '';
		}
	}

	function removeTag(tag: string): void {
		tags = tags.filter((t) => t !== tag);
	}

	// Function to render markdown preview
	function renderMarkdown(content: string): string {
		// This is a placeholder - in a real implementation you would use a markdown library
		// like marked.js with proper sanitization
		return content;
	}

	async function submitPost(): Promise<void> {
		console.log('Submitting post with role:', userRole);

		if (!title.trim() || !content.trim() || !$user) {
			error = 'Please fill in all required fields';
			return;
		}

		submitting = true;
		error = '';

		try {
			// FIXED: Improved role permission checking
			// Only instructors and TAs can create announcements
			if (postType === 'announcement' && userRole !== 'instructor' && userRole !== 'ta') {
				error = 'Only instructors and TAs can create announcements';
				submitting = false;
				return;
			}

			// Re-verify session before submission
			const { data: sessionData } = await supabase.auth.getSession();
			if (!sessionData?.session) {
				error = 'Your session has expired. Please sign in again.';
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
					tags: tags.length > 0 ? tags : null,
					status: 'open' // Explicitly set initial status
				})
				.select();

			if (postError) {
				console.error('Error creating post:', postError);
				error = 'Failed to create post. Please try again.';
			} else if (data && data.length > 0) {
				// Redirect to the new post
				goto(`/courses/${courseId}/posts/${data[0].id}`);
			}
		} catch (err) {
			console.error('Error in submitPost:', err);
			error = 'An unexpected error occurred while creating your post';
		} finally {
			submitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}
	
	function getPostTypeInfo(type: string) {
		switch(type) {
			case 'question':
				return {
					icon: HelpCircle,
					title: 'Question',
					description: 'Ask a question that needs an answer',
					color: 'text-blue-500'
				};
			case 'announcement':
				return {
					icon: Megaphone,
					title: 'Announcement',
					description: 'Share important information with the class',
					color: 'text-amber-500'
				};
			case 'note':
				return {
					icon: FileText,
					title: 'Note',
					description: 'Share knowledge or resources with others',
					color: 'text-purple-500'
				};
			default:
				return {
					icon: HelpCircle,
					title: 'Post',
					description: 'Create a new post',
					color: 'text-gray-500'
				};
		}
	}
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if loading}
		<div class="flex flex-col items-center justify-center py-16">
			<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
			<p class="mt-4 text-muted-foreground">Loading course information...</p>
		</div>
	{:else if course}
		<!-- Breadcrumb -->
		<div class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
			<a href="/courses" class="transition-colors hover:text-primary">Courses</a>
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-1"><polyline points="9 18 15 12 9 6"></polyline></svg>
			<a href="/courses/{courseId}" class="transition-colors hover:text-primary">{course.code}</a>
			<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-1"><polyline points="9 18 15 12 9 6"></polyline></svg>
			<span class="font-medium">New Post</span>
		</div>

		<div class="grid gap-6 md:grid-cols-4">
			<!-- Sidebar (Course Info & Guidelines) -->
			<div class="space-y-4 md:col-span-1">
				<Card class="overflow-hidden border-muted/60 shadow-sm">
					<CardHeader class="bg-gradient-to-br from-muted/50 to-muted/20 pb-3">
						<CardTitle class="flex items-center gap-2 text-lg">
							{course.code}
						</CardTitle>
						<CardDescription class="line-clamp-2">
							{course.name}
						</CardDescription>
					</CardHeader>
					<CardContent class="pt-4">
						<div class="mb-3 flex flex-wrap gap-2">
							<Badge variant="outline" class="bg-muted/50 px-2">
								{course.term}
							</Badge>
							{#if userRole}
								<Badge class="capitalize px-2">
									{userRole}
								</Badge>
							{/if}
						</div>
						
						<Separator class="mb-3" />
						
						<div class="space-y-3 text-sm">
							<h3 class="font-medium">Posting Guidelines:</h3>
							<ul class="space-y-2 text-muted-foreground">
								<li class="flex items-start gap-1.5">
									<span class="mt-0.5 text-primary">•</span>
									<span>Be clear and specific with your questions</span>
								</li>
								<li class="flex items-start gap-1.5">
									<span class="mt-0.5 text-primary">•</span>
									<span>Use appropriate tags to categorize your post</span>
								</li>
								<li class="flex items-start gap-1.5">
									<span class="mt-0.5 text-primary">•</span>
									<span>You can use Markdown to format your content</span>
								</li>
								<li class="flex items-start gap-1.5">
									<span class="mt-0.5 text-primary">•</span>
									<span>Be respectful and follow academic integrity</span>
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>
				
				<a href="/courses/{courseId}" class="block">
					<Button variant="outline" class="w-full justify-start">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="m15 18-6-6 6-6"></path></svg>
						Back to Course
					</Button>
				</a>
			</div>
			
			<!-- Main Content -->
			<div class="md:col-span-3">
				<Card class="shadow-md">
					<CardHeader class="border-b bg-muted/10 pb-4">
						<div class="flex items-center gap-3">
							{#if postType === 'question'}
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-500">
									<HelpCircle size={20} />
								</div>
							{:else if postType === 'announcement'}
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-500">
									<Megaphone size={20} />
								</div>
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-500">
									<FileText size={20} />
								</div>
							{/if}
							
							<div>
								<CardTitle class="text-xl">Create New {getPostTypeInfo(postType).title}</CardTitle>
								<CardDescription>{getPostTypeInfo(postType).description}</CardDescription>
							</div>
						</div>
					</CardHeader>

					<CardContent class="pt-5">
						{#if error}
							<Alert variant="destructive" class="mb-5 border-l-4 border-l-red-500">
								<AlertCircle class="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						{/if}

						<form id="post-form" class="space-y-5" on:submit|preventDefault={submitPost}>
							<!-- Post Type Selection -->
							<div class="space-y-2">
								<Label for="post-type" class="text-base font-medium">Post Type</Label>
								<div class="grid gap-3 md:grid-cols-3">
									<button
										type="button"
										class={`flex flex-col gap-1 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50 ${postType === 'question' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-400' : ''}`}
										on:click={() => postType = 'question'}
									>
										<div class="flex items-center gap-2">
											<HelpCircle class="text-blue-500" size={18} />
											<span class="font-medium">Question</span>
										</div>
										<p class="text-xs text-muted-foreground">Ask about course material or assignments</p>
									</button>
									
									<button
										type="button"
										class={`flex flex-col gap-1 rounded-lg border border-input p-3 text-left transition-colors hover:bg-muted/50 ${postType === 'note' ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-400' : ''}`}
										on:click={() => postType = 'note'}
									>
										<div class="flex items-center gap-2">
											<FileText class="text-purple-500" size={18} />
											<span class="font-medium">Note</span>
										</div>
										<p class="text-xs text-muted-foreground">Share helpful information with classmates</p>
									</button>
									
									<button
										type="button"
										class={`flex flex-col gap-1 rounded-lg border border-input p-3 text-left transition-colors 
										${postType === 'announcement' ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-400' : ''}
										${userRole !== 'instructor' && userRole !== 'ta' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'}`}
										on:click={() => {
											if (userRole === 'instructor' || userRole === 'ta') {
												postType = 'announcement';
											}
										}}
										disabled={userRole !== 'instructor' && userRole !== 'ta'}
									>
										<div class="flex items-center gap-2">
											<Megaphone class="text-amber-500" size={18} />
											<span class="font-medium">Announcement</span>
										</div>
										<p class="text-xs text-muted-foreground">
											{userRole === 'instructor' || userRole === 'ta' 
												? 'Share important information with the class' 
												: 'Only instructors and TAs can create announcements'}
										</p>
									</button>
								</div>
							</div>

							<!-- Title Field -->
							<div class="space-y-2">
								<Label for="title" class="text-base font-medium">Title</Label>
								<Input 
									id="title" 
									placeholder="Enter a descriptive title" 
									bind:value={title} 
									class="h-11"
								/>
							</div>

							<!-- Content Field with Editor/Preview Tabs -->
							<div class="space-y-2">
								<Label for="content" class="text-base font-medium">Content</Label>
								
								<Tabs.Root value={previewMode ? 'preview' : 'write'}>
									<Tabs.List class="w-full">
										<Tabs.Trigger value="write" class="flex-1" onclick={() => previewMode = false}>
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
											Write
										</Tabs.Trigger>
										<Tabs.Trigger value="preview" class="flex-1" onclick={() => previewMode = true}>
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
											Preview
										</Tabs.Trigger>
									</Tabs.List>

									<Tabs.Content value="write" class="pt-4 focus-visible:outline-none focus-visible:ring-0">
										<Textarea
											id="content"
											placeholder="Describe your question or post in detail..."
											rows={12}
											bind:value={content}
											class="min-h-[200px] resize-y"
										/>
										<div class="mt-2 rounded-md bg-muted/30 p-3 text-sm">
											<p class="mb-2 font-medium">Markdown Supported:</p>
											<div class="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5">**bold**</code>
													<span>for <strong>bold text</strong></span>
												</div>
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5">*italic*</code>
													<span>for <em>italic text</em></span>
												</div>
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5"># Heading</code>
													<span>for headings</span>
												</div>
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5">- list item</code>
													<span>for bullet lists</span>
												</div>
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5">[link](url)</code>
													<span>for links</span>
												</div>
												<div class="flex items-center gap-1">
													<code class="rounded bg-muted px-1 py-0.5">```code```</code>
													<span>for code blocks</span>
												</div>
											</div>
										</div>
									</Tabs.Content>

									<Tabs.Content value="preview" class="pt-4 focus-visible:outline-none focus-visible:ring-0">
										{#if content.trim()}
											<div class="prose prose-stone dark:prose-invert min-h-[200px] max-w-none break-words rounded-md border border-input p-4">
												{@html renderMarkdown(content)}
											</div>
										{:else}
											<div class="flex min-h-[200px] items-center justify-center rounded-md border border-input p-4 text-muted-foreground">
												<p>Nothing to preview yet. Start writing to see a preview.</p>
											</div>
										{/if}
									</Tabs.Content>
								</Tabs.Root>
							</div>

							<!-- Additional Options -->
							<div class="rounded-md border border-input p-4">
								<h3 class="mb-4 font-medium">Additional Options</h3>
								
								<div class="grid gap-5 md:grid-cols-2">
									<!-- Folder Selection -->
									<div class="space-y-2">
										<Label for="folder" class="flex items-center gap-1.5 text-sm">
											<Folder size={14} />
											Folder
										</Label>
										<div class="relative">
											<select
												id="folder"
												bind:value={selectedFolder}
												class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<option value="">None (Uncategorized)</option>
												{#each folders as folder}
													<option value={folder.id}>{folder.name}</option>
												{/each}
											</select>
										</div>
										<p class="text-xs text-muted-foreground">Organize your post in a specific folder</p>
									</div>
									
									<!-- Tags -->
									<div class="space-y-2">
										<Label class="flex items-center gap-1.5 text-sm">
											<Tag size={14} />
											Tags
										</Label>
										<div class="flex h-10 items-center rounded-md border border-input px-3 py-2">
											{#if tags.length > 0}
												<div class="flex flex-wrap gap-1">
													{#each tags as tag}
														<Badge variant="secondary" class="flex items-center gap-1 px-2 py-0.5">
															{tag}
															<button
																type="button"
																on:click={() => removeTag(tag)}
																class="ml-1 rounded-full text-muted-foreground hover:text-foreground"
															>
																<X size={12} />
															</button>
														</Badge>
													{/each}
												</div>
											{:else}
												<span class="text-sm text-muted-foreground">No tags added</span>
											{/if}
										</div>
										<div class="flex gap-2">
											<Input 
												placeholder="Add a tag" 
												bind:value={newTag} 
												onkeydown={handleKeydown} 
												class="h-9"
											/>
											<Button type="button" size="sm" variant="outline" onclick={addTag} disabled={tags.length >= 5}>
												<Plus size={16} />
											</Button>
										</div>
										<p class="text-xs text-muted-foreground">{5 - tags.length} tags remaining</p>
									</div>
								</div>
								
								<Separator class="my-4" />
								
								<!-- Posting Options -->
								<div class="grid gap-4 md:grid-cols-2">
									<div class="flex items-start space-x-2">
										<Checkbox id="anonymous" bind:checked={isAnonymous} />
										<div>
											<Label for="anonymous" class="flex cursor-pointer items-center gap-1.5">
												<span class="text-sm">
													{isAnonymous ? '🫣' : '👁️'}
												</span>
												<span>Post anonymously</span>
											</Label>
											<p class="text-xs text-muted-foreground">
												{userRole === 'student' 
													? 'Your posts are anonymous by default as a student' 
													: 'Hide your identity from other students'}
											</p>
										</div>
									</div>

									<div class="flex items-start space-x-2">
										<Checkbox id="private" bind:checked={isPrivate} />
										<div>
											<Label for="private" class="flex cursor-pointer items-center gap-1.5">
												<span class="text-sm">
												{isPrivate ? '🔒' : '🔓'}
												<span>Make private</span>
											</Label>
											<p class="text-xs text-muted-foreground">Only visible to instructors and TAs (under development)</p>
										</div>
									</div>
								</div>
							</div>
						</form>
					</CardContent>

					<CardFooter class="flex justify-between gap-2 border-t p-5">
						<a href="/courses/{courseId}">
							<Button variant="outline">Cancel</Button>
						</a>
						<Button 
							type="submit" 
							form="post-form" 
							disabled={submitting || !title.trim() || !content.trim()} 
							class="min-w-[120px]"
						>
							{#if submitting}
								<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
								</svg>
								Creating...
							{:else}
								<Send size={16} class="mr-2" />
								Create Post
							{/if}
						</Button>
					</CardFooter>
				</Card>
			</div>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
				<AlertCircle size={36} class="text-muted-foreground" />
			</div>
			<h2 class="mt-6 text-2xl font-semibold">Course Not Found</h2>
			<p class="mt-2 max-w-md text-muted-foreground">
				The course you're looking for doesn't exist or you don't have access to it.
			</p>
			<Button href="/courses" variant="outline" class="mt-6">Back to Courses</Button>
		</div>
	{/if}
</div>

<style>
  /* Add smooth transitions */
  .transition-colors {
    transition: all 0.2s ease-in-out;
  }
  
  /* Add subtle hover effect for interactive elements */
  button:not(:disabled):hover, 
  a:hover,
  select:hover,
  input:focus,
  textarea:focus {
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
  }
  
  /* Add subtle animation for radio buttons and option cards */
  button:active:not(:disabled) {
    transform: translateY(1px);
  }
  
  /* Improve focus styles for better accessibility */
  :focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  
  /* Customize scrollbar for textareas */
  textarea::-webkit-scrollbar {
    width: 8px;
  }
  
  textarea::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
  }
  
  textarea::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
  }
  
  textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.15);
  }
  
  /* Typography improvements */
  .prose p {
    line-height: 1.7;
  }
  
  .prose pre {
    background-color: rgb(246, 248, 250);
    border-radius: 6px;
    padding: 16px;
    overflow: auto;
  }
  
  .prose code {
    background-color: rgba(175, 184, 193, 0.2);
    border-radius: 4px;
    padding: 2px 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  
  /* Card hover effect */
  .card-hover {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .card-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  }
</style>