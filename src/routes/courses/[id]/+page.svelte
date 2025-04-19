<!-- src/routes/courses/[id]/+page.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { ensureAuthenticated } from '$lib/stores/auth'; // Import the new function

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
	let notePosts: PostData[] = [];
	let folders: FolderData[] = [];
	let loading: boolean = true;
	let course: CourseData | null = null;
	let searchQuery: string = '';
	let userRole: string = '';
	let useraff: string = '';
	let currentTab: string = 'all';
	let currentFolder: string | null = null;
	let expandedFolders: Set<string> = new Set();
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
				.select(
					`
          id, 
          title, 
          content,
          post_type,
          status,
          created_at,
          anonymous,
          user_id,
          folder_id
        `
				)
				.eq('course_id', courseId)
				.eq('is_private', false)
				.order('created_at', { ascending: false });

			if (postsError) {
				console.error('Error loading posts:', postsError);
				loading = false;
				return;
			}
			// Now we need to fetch user details and response counts separately
			const enhancedPosts = await Promise.all(
				(postsData || []).map(async (post) => {
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
				})
			);

			allPosts = enhancedPosts;
			questionPosts = enhancedPosts.filter((post) => post.post_type === 'question');
			announcementPosts = enhancedPosts.filter((post) => post.post_type === 'announcement');
			notePosts = enhancedPosts.filter((post) => post.post_type === 'note');

			// Group posts by folder
			folders = folders.map((folder) => {
				const folderPosts = enhancedPosts.filter((post) => post.folder_id === folder.id);
				return {
					...folder,
					posts: folderPosts
				};
			});

			// Add an "Uncategorized" virtual folder for posts without a folder
			const uncategorizedPosts = enhancedPosts.filter((post) => !post.folder_id);
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
		// First, ensure we have authentication
		let currentUser = $user;

		if (!currentUser) {
			console.log('No user in store, checking session');
			// Try to get session data directly
			const { data } = await supabase.auth.getSession();

			if (!data.session) {
				console.log('No authenticated user found, redirecting to login');
				const currentPath = window.location.pathname;
				window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
				return; // Stop further execution
			}

			// Important: Wait for auth initialization to complete and update the user store
			console.log('Session found, ensuring user data is loaded');
			await ensureAuthenticated(); // Use the new function from updated auth.ts

			// Get the updated user value after initialization
			currentUser = $user;

			// Still no user? Something went wrong
			if (!currentUser) {
				console.log('Failed to load user data');
				return;
			}
		}

		// Now we definitely have user data, proceed
		console.log('User authenticated:', currentUser.id);

		// Get user's role in this course
		const { data: memberData, error: memberError } = await supabase
			.from('course_members')
			.select('role')
			.eq('course_id', courseId)
			.eq('user_id', currentUser.id)
			.single();

		if (memberError) {
			console.error('Error fetching role:', memberError);
		} else if (memberData) {
			userRole = memberData.role;
			console.log('User role:', userRole);
		}
		// Get user's affiliation
		const { data: userAffData, error: userAffError } = await supabase
			.from('users')
			.select('affiliation')
			.eq('id', currentUser.id)
			.single();
		if (userAffError) {
			console.error('Error fetching user affiliation:', userAffError);
		} else if (userAffData) {
			useraff = userAffData.affiliation;
			console.log('User affiliation:', useraff);
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
		let filtered = allPosts.filter(
			(post) =>
				post.title.toLowerCase().includes(query) || post.content.toLowerCase().includes(query)
		);

		// Additional filtering based on tab
		if (currentTab === 'questions') {
			filtered = filtered.filter((post) => post.post_type === 'question');
		} else if (currentTab === 'announcements') {
			filtered = filtered.filter((post) => post.post_type === 'announcement');
		} else if (currentTab === 'notes') {
			filtered = filtered.filter((post) => post.post_type === 'note');
		}

		// Additional filtering based on folder
		if (currentFolder) {
			filtered = filtered.filter((post) => post.folder_id === currentFolder);
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
		} else if (tab === 'notes') {
			filteredPosts = notePosts;
		}

		// Then filter by folder if a folder is selected
		if (folderId) {
			filteredPosts = filteredPosts.filter((post) =>
				folderId === 'uncategorized' ? !post.folder_id : post.folder_id === folderId
			);
		}

		posts = filteredPosts;
	}

	// Toggle folder expansion
	function toggleFolder(folderId: string): void {
		if (expandedFolders.has(folderId)) {
			expandedFolders.delete(folderId);
		} else {
			expandedFolders.add(folderId);
		}
		expandedFolders = new Set(expandedFolders); // Force reactivity
	}

	// Format date display
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const oneDay = 24 * 60 * 60 * 1000;

		if (diff < oneDay) {
			// Today - show time
			return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diff < oneDay * 2) {
			// Yesterday
			return 'Yesterday';
		} else if (diff < oneDay * 7) {
			// Within a week
			return date.toLocaleDateString([], { weekday: 'long' });
		} else {
			// Older than a week
			return date.toLocaleDateString([], {
				month: 'short',
				day: 'numeric',
				year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
			});
		}
	}

	// Generate initials from name
	function getInitials(name: string | undefined): string {
		if (!name || name === 'Unknown') return 'U';
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	}

	// Get folder icon with color
	function getFolderIcon(name: string): string {
		// Generate consistent color based on folder name
		const hashCode = name.split('').reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
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
			'text-pink-500',
			'text-teal-500',
			'text-orange-500'
		];

		const colorClass = colors[Math.abs(hashCode) % colors.length];

		return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${colorClass}">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-9l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path>
    </svg>`;
	}

	// Get post type icon
	function getPostTypeIcon(type: string): string {
		if (type === 'question') {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <path d="M12 17h.01"></path>
      </svg>`;
		} else if (type === 'announcement') {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`;
		} else {
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>`;
		}
	}

	// Function to get appropriate status color
	function getStatusBadge(status: string): { color: string; icon: string } {
		switch (status) {
			case 'answered':
				return {
					color: 'bg-green-100 text-green-700 border-green-200',
					icon: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`
				};
			case 'open':
				return {
					color: 'bg-blue-100 text-blue-700 border-blue-200',
					icon: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>`
				};
			case 'closed':
				return {
					color: 'bg-gray-100 text-gray-700 border-gray-200',
					icon: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>`
				};
			default:
				return {
					color: 'bg-gray-100 text-gray-700 border-gray-200',
					icon: ''
				};
		}
	}

	// Render markdown content preview
	function renderMarkdownPreview(content: string): string {
		const markedOptions = {
			breaks: true,
			gfm: true
		};

		// Limit content length for preview
		const previewContent = content.length > 300 ? content.substring(0, 300) + '...' : content;

		// Parse markdown and sanitize HTML
		// Configure DOMPurify to allow certain tags and attributes
		const sanitizeOptions = {
			ALLOWED_TAGS: [
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'blockquote',
				'p',
				'a',
				'ul',
				'ol',
				'nl',
				'li',
				'b',
				'i',
				'strong',
				'em',
				'strike',
				'code',
				'hr',
				'br',
				'div',
				'table',
				'thead',
				'caption',
				'tbody',
				'tr',
				'th',
				'td',
				'pre',
				'img',
				'span'
			],
			ALLOWED_ATTR: ['href', 'name', 'target', 'src', 'alt', 'class', 'id', 'style']
		};

		return DOMPurify.sanitize(marked.parse(previewContent, markedOptions), sanitizeOptions);
	}

	// Count posts in folder
	function countPostsInFolder(folderId: string): number {
		if (folderId === 'uncategorized') {
			return allPosts.filter((post) => !post.folder_id).length;
		}
		return allPosts.filter((post) => post.folder_id === folderId).length;
	}

	function handleSearch(e: Event): void {
		e.preventDefault();
		searchPosts();
	}
</script>

<div class="container mx-auto px-4 py-8 md:px-6">
	{#if course}
		<!-- Course Header -->
		<div class="mb-8">
			<!-- Breadcrumb -->
			<div class="mb-4 flex items-center text-sm text-muted-foreground">
				<a href="/courses" class="transition-colors hover:text-primary">Courses</a>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mx-2 h-4 w-4"
				>
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
				<span class="font-medium text-foreground">{course.code}</span>
			</div>

			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 class="mb-2 text-3xl font-bold md:text-4xl">{course.code}: {course.name}</h1>
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="outline" class="px-3 text-sm">
							<span class="mr-1"
								>{course.term.includes('Fall')
									? '🍂'
									: course.term.includes('Spring')
										? '🌱'
										: course.term.includes('Summer')
											? '☀️'
											: course.term.includes('Winter')
												? '❄️'
												: '📚'}</span
							>
							{course.term}
						</Badge>
						{#if $user}
							<Badge
								variant="outline"
								class="border-blue-200 bg-blue-50 px-3 text-sm text-blue-700"
							>
								<span class="mr-1">👤</span>
								{$user.full_name}
							</Badge>
							<Badge variant="secondary" class="select-none px-3 text-sm capitalize text-blue-800">
								{useraff}
							</Badge>
						{/if}
						{#if userRole && userRole.trim() !== ''}
							<Badge variant="secondary" class="select-none px-3 text-sm capitalize">
								{userRole.toUpperCase()}
							</Badge>
						{/if}
						{#if course.is_active}
							<Badge variant="default" class="bg-green-500 text-white hover:bg-green-600"
								>Active</Badge
							>
						{:else}
							<Badge variant="outline" class="text-muted-foreground">Archived</Badge>
						{/if}
					</div>
				</div>

				<div class="flex gap-2">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="default" class="gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="12" y1="5" x2="12" y2="19"></line>
									<line x1="5" y1="12" x2="19" y2="12"></line>
								</svg>
								<span>New Post</span>
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-56">
							<DropdownMenu.Item>
								<a
									href="/courses/{courseId}/ask?type=question"
									class="flex w-full items-center gap-2"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-blue-500"
									>
										<circle cx="12" cy="12" r="10"></circle>
										<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
										<path d="M12 17h.01"></path>
									</svg>
									<span
										>Ask Question (3ปุ่มนี้กดไปเถอะ เหมือนกันหมด กำลังซ่อม ไปเลือกในหน้าต่อไปเอาจ้า)</span
									>
								</a>
							</DropdownMenu.Item>
							{#if userRole === 'instructor' || userRole === 'ta'}
								<DropdownMenu.Item>
									<a
										href="/courses/{courseId}/ask?type=announcement"
										class="flex w-full items-center gap-2"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-amber-500"
										>
											<path
												d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
											></path>
											<line x1="12" y1="9" x2="12" y2="13"></line>
											<line x1="12" y1="17" x2="12.01" y2="17"></line>
										</svg>
										<span>Create Announcement</span>
									</a>
								</DropdownMenu.Item>
							{/if}
							<DropdownMenu.Item>
								<a href="/courses/{courseId}/ask?type=note" class="flex w-full items-center gap-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-purple-500"
									>
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
										<polyline points="14 2 14 8 20 8"></polyline>
										<line x1="16" y1="13" x2="8" y2="13"></line>
										<line x1="16" y1="17" x2="8" y2="17"></line>
										<polyline points="10 9 9 9 8 9"></polyline>
									</svg>
									<span>Create Note</span>
								</a>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>

			{#if course.description}
				<div
					class="mt-4 rounded-lg border border-muted bg-gradient-to-r from-muted/30 to-muted/10 px-5 py-4"
				>
					<p class="text-muted-foreground">{course.description}</p>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-12 gap-6">
			<!-- Sidebar with folders -->
			<div class="col-span-12 space-y-4 md:col-span-3">
				<!-- Search box - this appears to be working fine -->
				<!-- Search box -->
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-muted-foreground"
						>
							<circle cx="11" cy="11" r="8"></circle>
							<path d="m21 21-4.3-4.3"></path>
						</svg>
					</div>

					<input
						type="text"
						bind:value={searchQuery}
						on:input={searchPosts}
						placeholder="Search posts..."
						class="w-full rounded-md border py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
					/>

					{#if searchQuery}
						<button
							class="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
							on:click={() => {
								searchQuery = '';
								setCurrentView(currentTab, currentFolder);
							}}
							aria-label="Clear search"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M18 6 6 18"></path>
								<path d="m6 6 12 12"></path>
							</svg>
						</button>
					{/if}
				</div>

				<!-- Content type filters -->
				<Card class="overflow-hidden">
					<CardHeader class="bg-muted/20 px-4 py-3">
						<CardTitle class="flex items-center gap-2 text-sm font-medium">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
							</svg>
							Content Types
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-1 p-2">
						<button
							type="button"
							class={`flex h-9 w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
								currentTab === 'all' && !currentFolder
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-transparent text-foreground hover:bg-muted'
							}`}
							on:click={() => {
								handleTabChange('all');
								handleFolderChange(null);
							}}
						>
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
								</svg>
								<span>All Posts</span>
							</div>
							<Badge
								variant="outline"
								class={`ml-auto ${currentTab === 'all' && !currentFolder ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted'}`}
							>
								{allPosts.length}
							</Badge>
						</button>

						<!-- Questions Button -->
						<button
							type="button"
							class={`flex h-9 w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
								currentTab === 'questions' && !currentFolder
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-transparent text-foreground hover:bg-muted'
							}`}
							on:click={() => {
								handleTabChange('questions');
								handleFolderChange(null);
							}}
						>
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-blue-500"
								>
									<circle cx="12" cy="12" r="10"></circle>
									<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
									<path d="M12 17h.01"></path>
								</svg>
								<span>Questions</span>
							</div>
							<Badge
								variant="outline"
								class={`ml-auto ${currentTab === 'questions' && !currentFolder ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted'}`}
							>
								{questionPosts.length}
							</Badge>
						</button>

						<!-- Announcements Button -->
						<button
							type="button"
							class={`flex h-9 w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
								currentTab === 'announcements' && !currentFolder
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-transparent text-foreground hover:bg-muted'
							}`}
							on:click={() => {
								handleTabChange('announcements');
								handleFolderChange(null);
							}}
						>
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-amber-500"
								>
									<path
										d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
									></path>
									<line x1="12" y1="9" x2="12" y2="13"></line>
									<line x1="12" y1="17" x2="12.01" y2="17"></line>
								</svg>
								<span>Announcements</span>
							</div>
							<Badge
								variant="outline"
								class={`ml-auto ${currentTab === 'announcements' && !currentFolder ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted'}`}
							>
								{announcementPosts.length}
							</Badge>
						</button>

						<button
							type="button"
							class={`flex h-9 w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
								currentTab === 'notes' && !currentFolder
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-transparent text-foreground hover:bg-muted'
							}`}
							on:click={() => {
								handleTabChange('notes');
								handleFolderChange(null);
							}}
						>
							<div class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-purple-500"
								>
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
									<line x1="16" y1="13" x2="8" y2="13"></line>
									<line x1="16" y1="17" x2="8" y2="17"></line>
									<polyline points="10 9 9 9 8 9"></polyline>
								</svg>
								<span>Notes</span>
							</div>
							<Badge
								variant="outline"
								class={`ml-auto ${currentTab === 'notes' && !currentFolder ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted'}`}
							>
								{notePosts.length}
							</Badge>
						</button>
					</CardContent>
				</Card>

				<!-- Folders Section -->
				{#if folders.length > 0}
					<Card class="overflow-hidden">
						<CardHeader class="bg-muted/20 px-4 py-3">
							<CardTitle class="flex items-center gap-2 text-sm font-medium">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
									></path>
								</svg>
								Folders
							</CardTitle>
						</CardHeader>
						<CardContent class="max-h-[320px] space-y-0.5 overflow-y-auto p-2">
							{#each folders as folder (folder.id)}
								<div class="overflow-hidden rounded-md">
									<div
										class={`flex w-full items-center justify-between rounded-md p-2 text-sm font-medium transition-colors ${currentFolder === folder.id ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-muted'}`}
									>
										<button
											type="button"
											class="flex flex-1 cursor-pointer items-center gap-2 overflow-hidden border-0 bg-transparent p-0 text-left"
											on:click={() => handleFolderChange(folder.id)}
										>
											<span>{@html getFolderIcon(folder.name)}</span>
											<span class="truncate">{folder.name}</span>
										</button>
										<div class="flex items-center gap-2">
											<Badge
												variant="outline"
												class={currentFolder === folder.id
													? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30'
													: ''}
											>
												{countPostsInFolder(folder.id)}
											</Badge>
											<button
												type="button"
												class="flex size-5 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-transform duration-200 hover:bg-muted-foreground/10"
												class:rotate-180={expandedFolders.has(folder.id)}
												on:click={(event) => {
													event.stopPropagation();
													toggleFolder(folder.id);
												}}
												aria-label={expandedFolders.has(folder.id)
													? 'Collapse folder'
													: 'Expand folder'}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<polyline points="6 9 12 15 18 9"></polyline>
												</svg>
											</button>
										</div>
									</div>

									{#if expandedFolders.has(folder.id)}
										<div class="ml-2 space-y-0.5 border-l-2 border-muted pb-1 pl-8 pr-2">
											<button
												type="button"
												class="flex h-8 w-full justify-start rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
												on:click={() => {
													handleTabChange('all');
													handleFolderChange(folder.id);
												}}
											>
												<span>All content</span>
											</button>

											{#if (folder.posts || []).some((post) => post.post_type === 'question')}
												<button
													type="button"
													class="flex h-8 w-full justify-start rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
													on:click={() => {
														handleTabChange('questions');
														handleFolderChange(folder.id);
													}}
												>
													<span>Questions only</span>
												</button>
											{/if}

											{#if (folder.posts || []).some((post) => post.post_type === 'announcement')}
												<button
													type="button"
													class="flex h-8 w-full justify-start rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
													on:click={() => {
														handleTabChange('announcements');
														handleFolderChange(folder.id);
													}}
												>
													<span>Announcements only</span>
												</button>
											{/if}

											{#if (folder.posts || []).some((post) => post.post_type === 'note')}
												<button
													type="button"
													class="flex h-8 w-full justify-start rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
													on:click={() => {
														handleTabChange('notes');
														handleFolderChange(folder.id);
													}}
												>
													<span>Notes only</span>
												</button>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</CardContent>
					</Card>
				{/if}
			</div>

			<!-- Main content area -->
			<div class="col-span-12 md:col-span-9">
				<Card class="h-full">
					<CardHeader class="border-b bg-muted/10 pb-3">
						<div class="flex items-center justify-between">
							<CardTitle class="flex items-center gap-2">
								{#if currentFolder}
									<span>
										{@html getFolderIcon(
											folders.find((f) => f.id === currentFolder)?.name || 'Folder'
										)}
									</span>
									{folders.find((f) => f.id === currentFolder)?.name || 'Posts'}
								{:else if currentTab === 'questions'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-blue-500"
									>
										<circle cx="12" cy="12" r="10"></circle>
										<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
										<path d="M12 17h.01"></path>
									</svg>
									Questions
								{:else if currentTab === 'announcements'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-amber-500"
									>
										<path
											d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
										></path>
										<line x1="12" y1="9" x2="12" y2="13"></line>
										<line x1="12" y1="17" x2="12.01" y2="17"></line>
									</svg>
									Announcements
								{:else if currentTab === 'notes'}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										class="text-purple-500"
									>
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
										<polyline points="14 2 14 8 20 8"></polyline>
										<line x1="16" y1="13" x2="8" y2="13"></line>
										<line x1="16" y1="17" x2="8" y2="17"></line>
										<polyline points="10 9 9 9 8 9"></polyline>
									</svg>
									Notes
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
									</svg>
									All Posts
								{/if}
							</CardTitle>

							{#if searchQuery}
								<Badge variant="secondary" class="flex items-center gap-1 px-3 py-1">
									<span>Search: {searchQuery}</span>
									<button
										class="ml-1 opacity-70 hover:opacity-100"
										type="button"
										aria-label="Clear search"
										on:click={() => {
											searchQuery = '';
											setCurrentView(currentTab, currentFolder);
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M18 6 6 18"></path>
											<path d="m6 6 12 12"></path>
										</svg>
									</button>
								</Badge>
							{/if}
						</div>
						<CardDescription>
							{#if currentFolder}
								Showing {posts.length}
								{posts.length === 1 ? 'post' : 'posts'} in {folders.find(
									(f) => f.id === currentFolder
								)?.name || 'folder'}
							{:else if currentTab === 'questions'}
								Showing {posts.length} {posts.length === 1 ? 'question' : 'questions'}
							{:else if currentTab === 'announcements'}
								Showing {posts.length} {posts.length === 1 ? 'announcement' : 'announcements'}
							{:else if currentTab === 'notes'}
								Showing {posts.length} {posts.length === 1 ? 'note' : 'notes'}
							{:else}
								Showing {posts.length} {posts.length === 1 ? 'post' : 'posts'} from all categories
							{/if}
						</CardDescription>
					</CardHeader>

					<CardContent class="p-0">
						{#if loading}
							<div class="flex justify-center py-12">
								<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
							</div>
						{:else if posts.length === 0}
							<div class="flex flex-col items-center justify-center px-4 py-16">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/30">
									{#if searchQuery}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-muted-foreground"
										>
											<circle cx="11" cy="11" r="8"></circle>
											<path d="m21 21-4.3-4.3"></path>
										</svg>
									{:else if currentTab === 'questions'}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-blue-500"
										>
											<circle cx="12" cy="12" r="10"></circle>
											<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
											<path d="M12 17h.01"></path>
										</svg>
									{:else if currentTab === 'announcements'}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-amber-500"
										>
											<path
												d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
											></path>
											<line x1="12" y1="9" x2="12" y2="13"></line>
											<line x1="12" y1="17" x2="12.01" y2="17"></line>
										</svg>
									{:else if currentFolder}
										<span>
											{@html getFolderIcon(
												folders.find((f) => f.id === currentFolder)?.name || 'Folder'
											)}
										</span>
									{:else}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="text-muted-foreground"
										>
											<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
											></path>
										</svg>
									{/if}
								</div>

								{#if searchQuery}
									<h3 class="mb-2 text-xl font-medium">No posts match your search</h3>
									<p class="mb-6 max-w-md text-center text-muted-foreground">
										Try adjusting your search terms or try different keywords
									</p>
									<Button
										variant="outline"
										onclick={() => {
											searchQuery = '';
											setCurrentView(currentTab, currentFolder);
										}}
									>
										Clear Search
									</Button>
								{:else if currentFolder}
									<h3 class="mb-2 text-xl font-medium">No posts in this folder</h3>
									<p class="mb-6 max-w-md text-center text-muted-foreground">
										This folder doesn't contain any posts yet
									</p>
									<div class="flex gap-2">
										<Button variant="outline" onclick={() => handleFolderChange(null)}>
											View All Posts
										</Button>
										<a href="/courses/{courseId}/ask">
											<Button>Create Post</Button>
										</a>
									</div>
								{:else}
									<h3 class="mb-2 text-xl font-medium">No posts found</h3>
									<p class="mb-6 max-w-md text-center text-muted-foreground">
										Be the first to create a post in this course
									</p>
									<a href="/courses/{courseId}/ask">
										<Button>Create Post</Button>
									</a>
								{/if}
							</div>
						{:else}
							<div class="divide-y">
								{#each posts as post}
									<div
										class={`relative transition-colors hover:bg-muted/5 ${post.post_type === 'announcement' ? 'border-l-4 border-amber-500' : ''}`}
									>
										<a
											href="/courses/{courseId}/posts/{post.id}"
											class="absolute inset-0 z-10"
											aria-hidden="true"
										></a>
										<div class="flex flex-col gap-4 p-5 lg:flex-row">
											<!-- Left side: Post metadata -->
											<div class="flex flex-row justify-between lg:w-52 lg:flex-col">
												<div class="relative z-20 flex items-center gap-2">
													<Avatar class="h-9 w-9">
														<AvatarFallback
															class={`${
																!post.anonymous && post.users?.role === 'instructor'
																	? 'bg-amber-100 text-amber-700'
																	: !post.anonymous && post.users?.role === 'ta'
																		? 'bg-purple-100 text-purple-700'
																		: 'bg-muted text-muted-foreground'
															}`}
														>
															{post.anonymous ? 'A' : getInitials(post.users?.full_name)}
														</AvatarFallback>
													</Avatar>

													<div>
														<div class="truncate text-sm font-medium">
															{post.anonymous ? 'Anonymous' : post.users?.full_name || 'Unknown'}
														</div>
														<div class="flex items-center gap-1 text-xs text-muted-foreground">
															{#if !post.anonymous && post.users?.role}
																<Badge
																	variant={post.users?.role === 'instructor'
																		? 'default'
																		: post.users?.role === 'ta'
																			? 'secondary'
																			: 'outline'}
																	class="h-4 px-1 py-0 text-[10px] font-normal"
																>
																	{post.users?.role === 'instructor'
																		? 'Instructor'
																		: post.users?.role === 'ta'
																			? 'TA'
																			: 'Student'}
																</Badge>
																<span class="mx-1">•</span>
															{/if}
															{formatDate(post.created_at)}
														</div>
													</div>
												</div>

												<div
													class="relative z-20 flex items-end gap-2 lg:mt-3 lg:flex-col lg:items-start"
												>
													<Badge variant="secondary" class="flex h-6 items-center gap-1">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<path
																d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
															></path>
														</svg>
														<span>{post.response_count}</span>
													</Badge>

													<Badge
														variant={post.post_type === 'question'
															? 'outline'
															: post.post_type === 'announcement'
																? 'default'
																: 'secondary'}
														class="flex h-6 items-center gap-1"
													>
														<span class="text-xs">
															{@html getPostTypeIcon(post.post_type)}
														</span>
														<span class="text-xs capitalize">{post.post_type}</span>
													</Badge>

													{#if post.post_type === 'question'}
														{@const statusBadge = getStatusBadge(post.status)}
														<div
															class={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusBadge.color}`}
														>
															<span>{@html statusBadge.icon}</span> <span>{post.status}</span>
														</div>
													{/if}
												</div>
											</div>

											<!-- Post content (right side) -->
											<div class="min-w-0 flex-1">
												<h3 class="group relative z-20 mb-2 text-lg font-semibold">
													<a
														href="/courses/{courseId}/posts/{post.id}"
														class="transition-colors hover:text-primary"
													>
														{post.title}
													</a>
												</h3>

												<div
													class="prose prose-sm mb-4 line-clamp-3 max-w-none text-muted-foreground"
												>
													{@html renderMarkdownPreview(post.content)}
												</div>

												<div class="relative z-20 mt-auto flex items-center justify-between">
													{#if post.folder_id && post.folder_id !== 'uncategorized'}
														<Badge
															variant="outline"
															class="pointer-events-auto flex items-center gap-1"
														>
															<span>
																{@html getFolderIcon(
																	folders.find((f) => f.id === post.folder_id)?.name || 'Folder'
																)}
															</span>
															<span
																>{folders.find((f) => f.id === post.folder_id)?.name ||
																	'Folder'}</span
															>
														</Badge>
													{:else}
														<div></div>
													{/if}

													<a
														href="/courses/{courseId}/posts/{post.id}"
														class="pointer-events-auto relative z-20"
													>
														<Button variant="ghost" size="sm" class="gap-1">
															<span>View post</span>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																width="16"
																height="16"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path d="M5 12h14"></path>
																<path d="m12 5 7 7-7 7"></path>
															</svg>
														</Button>
													</a>
												</div>
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
			<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
		</div>
	{:else}
		<!-- Course not found state -->
		<div class="py-12 text-center">
			<div class="flex flex-col items-center">
				<div class="mb-6 flex size-20 items-center justify-center rounded-full bg-muted/50">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="36"
						height="36"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-muted-foreground"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<path d="M12 8v4"></path>
						<path d="M12 16h.01"></path>
					</svg>
				</div>
				<h2 class="mb-2 text-2xl font-semibold">Course Not Found</h2>
				<p class="mb-6 text-muted-foreground">
					The course you're looking for doesn't exist or you don't have access to it.
				</p>
				<a href="/courses">
					<Button variant="outline">Back to Courses</Button>
				</a>
			</div>
		</div>
	{/if}
</div>
