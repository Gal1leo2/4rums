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
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { X, Plus, AlertCircle } from 'lucide-svelte';

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


	onMount(async () => {
		// Track whether we've seen an auth event since page load
		let hadAuthStateChange = false;

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

		// Start loading course data
		await loadCourseData();

		// Set up auth state change listener
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event) => {
			console.log(`Auth state change detected: ${event}`);
			hadAuthStateChange = true;

			// After an auth change, we need to manually refresh the connection
			if (event === 'SIGNED_IN') {
				// Wait a brief moment for internal state to update
				setTimeout(async () => {
					console.log('Performing post-auth connection refresh...');
					try {
						// Force a new connection by doing a simple read operation
						await supabase.from('posts').select('count', { count: 'exact', head: true }).limit(1);
						console.log('Post-auth connection refresh successful');
					} catch (e) {
						console.warn('Post-auth connection refresh failed:', e);
					}
				}, 500);
			}
		});

		// Start connection pings immediately
		console.log('Starting connection pings...');
		const pingInterval = setInterval(async () => {
			try {
				// Simple lightweight ping to keep the connection warm
				const start = Date.now();
				await supabase.from('posts').select('count', { count: 'exact', head: true }).limit(1);

				const elapsed = Date.now() - start;
				console.log(`Connection ping successful (${elapsed}ms)`);
			} catch (e) {
				console.warn('Connection ping failed:', e);
			}
		}, 2000); // Every 2 seconds

		// Clean up the interval and subscription when component is destroyed
		return () => {
			if (pingInterval) clearInterval(pingInterval);
			subscription.unsubscribe();
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

			// Get user's role in this course
			if ($user) {
				const { data: memberData, error: memberError } = await supabase
					.from('course_members')
					.select('role')
					.eq('course_id', courseId)
					.eq('user_id', $user.id)
					.single();

				if (!memberError && memberData) {
					userRole = memberData.role;

					// Set isAnonymous default based on role
					if (userRole === 'student') {
						isAnonymous = true;
					}
				} else if (memberError) {
					console.error('Error fetching user role:', memberError);
					error = 'You do not have permission to post in this course';
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

	// Updated submitPost function with session refresh handling
	async function submitPost(): Promise<void> {
		console.log('1. submitPost function called');

		if (!title.trim() || !content.trim() || !$user) {
			console.log('2. Validation failed', {
				title: !!title.trim(),
				content: !!content.trim(),
				user: !!$user
			});
			error = 'Please fill in all required fields';
			return;
		}

		console.log('3. Validation passed');
		submitting = true;
		error = '';

		try {
			console.log('4. Checking post type permissions');
			// Only instructors and TAs can create announcements
			if (postType === 'announcement' && userRole !== 'instructor' && userRole !== 'ta') {
				console.log('5. Announcement permission check failed');
				error = 'Only instructors and TAs can create announcements';
				return;
			}

			console.log('6. Sending post to API...');

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
					tags: tags.length > 0 ? tags : null
				})
				.select();

			console.log('7. API response received', { data: !!data, error: !!postError });

			if (postError) {
				console.error('Error creating post:', postError);
				error = 'Failed to create post. Please try again.';
			} else if (data && data.length > 0) {
				console.log('8. Redirecting to new post');
				// Redirect to the new post
				goto(`/courses/${courseId}/posts/${data[0].id}`);
			}
		} catch (err) {
			console.error('9. Error caught:', err);
			error = 'An unexpected error occurred while creating your post';
		} finally {
			console.log('10. Finally block - setting submitting to false');
			submitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}
</script>

<div class="container mx-auto max-w-3xl py-8">
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
		</div>
	{:else if course}
		<!-- Breadcrumb -->
		<div class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
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

				<form id="post-form" class="space-y-4" on:submit|preventDefault={submitPost}>
					<div class="space-y-2">
						<Label for="post-type">Post Type</Label>
						<div class="relative">
							<select
								id="post-type"
								bind:value={postType}
								class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="question">Question</option>
								<option value="note">Note</option>
								<option value="announcement">Announcement</option>
							</select>
						</div>
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
						<div class="relative">
							<select
								id="folder"
								bind:value={selectedFolder}
								class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="">None</option>
								{#each folders as folder}
									<option value={folder.id}>{folder.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="space-y-2">
						<Label>Tags (Optional)</Label>
						<div class="mb-2 flex flex-wrap gap-2">
							{#each tags as tag}
								<div class="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
									{tag}
									<button
										type="button"
										on:click={() => removeTag(tag)}
										class="text-muted-foreground"
									>
										<X class="h-3 w-3" />
									</button>
								</div>
							{/each}
						</div>
						<div class="flex gap-2">
							<Input placeholder="Add a tag" bind:value={newTag} onkeydown={handleKeydown} />
							<Button type="button" variant="outline" onclick={addTag} disabled={tags.length >= 5}>
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
				<a
					href="/courses/{courseId}"
					class="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
				>
					Cancel
				</a>
				<Button type="submit" form="post-form" disabled={submitting}>
					{submitting ? 'Creating...' : 'Create Post'}
				</Button>
			</CardFooter>
		</Card>
	{:else}
		<div class="py-12 text-center">
			<p>Course not found</p>
			<Button href="/courses" variant="outline" class="mt-4">Back to Courses</Button>
		</div>
	{/if}
</div>
