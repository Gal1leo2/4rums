<!-- src/routes/courses/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase/client';
	import { user } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardFooter,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import RandomGreeting from '$lib/components/RandomGreeting.svelte';

	// Define TypeScript interfaces
	interface Course {
		id: string;
		code: string;
		name: string;
		term: string;
		description?: string;
		is_active: boolean;
		role?: string;
	}

	interface DebugInfo {
		rawData: any | null;
		validEntries: any | null;
		error: Error | null;
	}
	let userFullName: string = '';
	let activeCourses: Course[] = [];
	let inactiveCourses: Course[] = [];
	let loading: boolean = true;
	let searchTerm: string = '';
	let activeTab: 'active' | 'inactive' | 'all' = 'all';
	let debugInfo: DebugInfo = {
		rawData: null,
		validEntries: null,
		error: null
	};

	// Course layout view - grid or list
	let viewMode: 'grid' | 'list' = 'grid';

	// Current term - derived from active courses
	$: currentTerm = activeCourses.length > 0 ? activeCourses[0].term : 'Spring 2025'; // Fallback

	onMount(async () => {
		console.log('Courses page mounted');

		// Use the $user store that's already available
		if ($user) {
			console.log('User found in store:', $user.id);
			userFullName = $user.full_name;
			await loadCourses($user.id);
		} else {
			console.log('No user found in store, checking session directly');

			// Fallback: Direct check for auth session if store isn't ready yet
			const { data } = await supabase.auth.getSession();

			if (data.session) {
				console.log('Session found directly:', data.session.user.id);
				userFullName = data.session.user.user_metadata.full_name || 'User';
				await loadCourses(data.session.user.id);
			} else {
				console.log('No authenticated user found');
				loading = false;
			}
		}
	});

	async function loadCourses(userId: string): Promise<void> {
		console.log('Loading courses for user:', userId);

		try {
			// First, let's check if the user has any course memberships
			const { data: membershipCheck, error: membershipError } = await supabase
				.from('course_members')
				.select('course_id')
				.eq('user_id', userId);

			if (membershipError) {
				console.error('Error checking memberships:', membershipError);
				debugInfo.error = membershipError;
				loading = false;
				return;
			}

			console.log('Membership check:', membershipCheck);

			if (!membershipCheck || membershipCheck.length === 0) {
				console.log('No course memberships found for user');
				debugInfo.error = { message: 'No course memberships found for user' } as any;
				loading = false;
				return;
			}

			// Now load the full course data
			const { data, error } = await supabase
				.from('course_members')
				.select(
					`
          role,
          courses:course_id (
            id, 
            code, 
            name,
            term,
            description,
            is_active
          )
        `
				)
				.eq('user_id', userId);

			if (error) {
				console.error('Error loading courses:', error);
				debugInfo.error = error;
				loading = false;
				return;
			}

			console.log('Raw course data:', data);
			debugInfo.rawData = data;

			// Process the data - handle empty results correctly
			const validEntries = data ? data.filter((item) => item && item.courses) : [];
			debugInfo.validEntries = validEntries;

			console.log('Valid entries:', validEntries);

			// Check if we have any valid entries
			if (validEntries.length === 0) {
				console.log('No valid course entries found');
				debugInfo.error = {
					message: 'No valid course entries found - courses might be missing'
				} as any;
				loading = false;
				return;
			}

			// Separate active and inactive courses
			activeCourses = validEntries
				.filter((item) => item.courses.is_active === true)
				.map((item) => ({
					id: item.courses.id,
					code: item.courses.code,
					name: item.courses.name,
					term: item.courses.term,
					description: item.courses.description,
					role: item.role,
					is_active: true
				}))
				.sort((a, b) => a.code.localeCompare(b.code)); // Sort by course code

			inactiveCourses = validEntries
				.filter((item) => item.courses.is_active === false)
				.map((item) => ({
					id: item.courses.id,
					code: item.courses.code,
					name: item.courses.name,
					term: item.courses.term,
					description: item.courses.description,
					role: item.role,
					is_active: false
				}))
				.sort((a, b) => a.code.localeCompare(b.code)); // Sort by course code

			console.log('Active courses:', activeCourses);
			console.log('Inactive courses:', inactiveCourses);
		} catch (err) {
			console.error('Error in loadCourses:', err);
			debugInfo.error = err as Error;
		} finally {
			loading = false;
		}
	}

	// Filtered courses based on search and active tab
	$: filteredCourses = searchTerm
		? filterCourses()
		: activeTab === 'active'
			? activeCourses
			: activeTab === 'inactive'
				? inactiveCourses
				: [...activeCourses, ...inactiveCourses];

	// Filter courses based on search term
	function filterCourses() {
		const searchLower = searchTerm.toLowerCase();
		const matchingCourses = [];

		if (activeTab === 'active' || activeTab === 'all') {
			matchingCourses.push(
				...activeCourses.filter(
					(course) =>
						course.code.toLowerCase().includes(searchLower) ||
						course.name.toLowerCase().includes(searchLower) ||
						(course.description && course.description.toLowerCase().includes(searchLower))
				)
			);
		}

		if (activeTab === 'inactive' || activeTab === 'all') {
			matchingCourses.push(
				...inactiveCourses.filter(
					(course) =>
						course.code.toLowerCase().includes(searchLower) ||
						course.name.toLowerCase().includes(searchLower) ||
						(course.description && course.description.toLowerCase().includes(searchLower))
				)
			);
		}

		return matchingCourses;
	}

	// Helper function to determine term icon
	function getTermIcon(term: string | undefined): string {
		if (!term) return '📚';
		const termLower = String(term).toLowerCase();
		if (termLower.includes('spring') || termLower.includes('semester 1')) return '🌱';
		if (termLower.includes('fall') || termLower.includes('semester 2')) return '🍂';
		if (termLower.includes('summer')) return '☀️';
		if (termLower.includes('winter')) return '❄️';
		return '📚';
	}

	// Get random color for course cards based on course code
	function getCardColor(code: string | undefined, isActive: boolean): string {
		if (!isActive) {
			return 'border-gray-200 bg-muted/5 hover:bg-muted/15 text-muted-foreground';
		}

		// Define colors for active courses
		const colors = [
			'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/40 hover:from-blue-100 hover:to-blue-200/40',
			'border-green-200 bg-gradient-to-br from-green-50 to-green-100/40 hover:from-green-100 hover:to-green-200/40',
			'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/40 hover:from-purple-100 hover:to-purple-200/40',
			'border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100/40 hover:from-pink-100 hover:to-pink-200/40',
			'border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/40 hover:from-yellow-100 hover:to-yellow-200/40',
			'border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/40 hover:from-indigo-100 hover:to-indigo-200/40',
			'border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/40 hover:from-teal-100 hover:to-teal-200/40',
			'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/40 hover:from-amber-100 hover:to-amber-200/40'
		];

		if (!code) return colors[0];

		// Hash function to get consistent color based on course code
		let hash = 0;
		for (let i = 0; i < code.length; i++) {
			hash = (hash << 5) - hash + code.charCodeAt(i);
			hash = hash & hash; // Convert to 32bit integer
		}
		return colors[Math.abs(hash) % colors.length];
	}

	// Get role badge styling based on role
	function getRoleBadgeStyle(role: string | undefined): string {
		if (!role) return 'bg-gray-100 text-gray-700';

		switch (role.toLowerCase()) {
			case 'instructor':
				return 'bg-amber-100 text-amber-800 border-amber-200';
			case 'ta':
				return 'bg-purple-100 text-purple-800 border-purple-200';
			case 'student':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			default:
				return 'bg-gray-100 text-gray-700 border-gray-200';
		}
	}
</script>

<div class="container mx-auto px-4 py-8">
	<!-- Header Section with Search and Filters -->
	<div class="mb-8 flex flex-col items-start justify-between gap-4 lg:flex-row">
		<div class="space-y-2">
			<div class="flex flex-col items-start gap-3">
				<!-- Use items-start instead of items-center -->
				<h1 class="text-xl font-bold">
					<RandomGreeting userName={userFullName} />
				</h1>
				<h1 class="text-3xl font-bold">My Courses</h1>
				<!-- Removed text-left as it's already handled by items-start -->

				{#if !loading && (activeCourses.length > 0 || inactiveCourses.length > 0)}
					<Badge
						variant="outline"
						class="flex items-center gap-1.5 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5"
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
							<rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
							<line x1="16" x2="16" y1="2" y2="6"></line>
							<line x1="8" x2="8" y1="2" y2="6"></line>
							<line x1="3" x2="21" y1="10" y2="10"></line>
							<path d="M8 14h.01"></path>
							<path d="M12 14h.01"></path>
							<path d="M16 14h.01"></path>
							<path d="M8 18h.01"></path>
							<path d="M12 18h.01"></path>
							<path d="M16 18h.01"></path>
						</svg>
						<span class="font-medium">{getTermIcon(currentTerm)} {currentTerm}</span>
					</Badge>
				{/if}
			</div>
			<p class="text-muted-foreground">Access your enrolled courses and learning materials</p>
		</div>

		<div class="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
			<!-- Search Input -->
			<div class="relative flex-1">
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
					bind:value={searchTerm}
					placeholder="Search courses..."
					class="w-full rounded-md border py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
				/>
				{#if searchTerm}
					<button
						class="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
						on:click={() => (searchTerm = '')}
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

			<!-- View Toggle -->
			<div class="flex overflow-hidden rounded-md border">
				<button
					type="button"
					class={`flex h-10 w-10 items-center justify-center ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted/20'}`}
					on:click={() => (viewMode = 'grid')}
					aria-label="Grid view"
				>
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
						<rect width="7" height="7" x="3" y="3" rx="1"></rect>
						<rect width="7" height="7" x="14" y="3" rx="1"></rect>
						<rect width="7" height="7" x="14" y="14" rx="1"></rect>
						<rect width="7" height="7" x="3" y="14" rx="1"></rect>
					</svg>
				</button>
				<button
					type="button"
					class={`flex h-10 w-10 items-center justify-center ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted/20'}`}
					on:click={() => (viewMode = 'list')}
					aria-label="List view"
				>
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
						<line x1="8" x2="21" y1="6" y2="6"></line>
						<line x1="8" x2="21" y1="12" y2="12"></line>
						<line x1="8" x2="21" y1="18" y2="18"></line>
						<line x1="3" x2="3.01" y1="6" y2="6"></line>
						<line x1="3" x2="3.01" y1="12" y2="12"></line>
						<line x1="3" x2="3.01" y1="18" y2="18"></line>
					</svg>
				</button>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex flex-col items-center justify-center py-20">
			<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
			<p class="mt-4 animate-pulse text-muted-foreground">Loading your courses...</p>
		</div>
	{:else if !$user}
		<!-- Not Logged In State -->
		<Card class="border-2 border-dashed bg-gradient-to-br from-muted/20 to-muted/5">
			<CardContent class="flex flex-col items-center py-16">
				<div class="mb-6 rounded-full border border-blue-200 bg-blue-50 p-6">
					<!-- Users Icon as SVG -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="text-blue-500"
					>
						<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
						<circle cx="9" cy="7" r="4"></circle>
						<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
						<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
					</svg>
				</div>
				<h2 class="mb-4 text-center text-2xl font-semibold">Sign in to view your courses</h2>
				<p class="mb-8 max-w-md text-center text-muted-foreground">
					You need to be logged in to see the courses you're enrolled in and access your learning
					materials.
				</p>
				<a href="/auth/login?redirect=/courses">
					<Button size="lg" class="px-8">
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
							class="mr-2"
						>
							<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
							<polyline points="10 17 15 12 10 7"></polyline>
							<line x1="15" x2="3" y1="12" y2="12"></line>
						</svg>
						Sign In
					</Button>
				</a>
			</CardContent>
		</Card>
	{:else if debugInfo.error}
		<!-- Error State -->
		<div class="rounded-lg border-2 border-dashed bg-muted/5 px-4 py-6">
			<div class="mx-auto max-w-3xl">
				<Alert variant="destructive" class="mb-6 border-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="mr-2"
					>
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
						></path>
						<path d="M12 9v4"></path>
						<path d="M12 17h.01"></path>
					</svg>
					<AlertTitle>Error Loading Courses</AlertTitle>
					<AlertDescription>
						{debugInfo.error.message || 'Unknown error occurred while loading your courses.'}
					</AlertDescription>
				</Alert>

				<Card class="overflow-hidden bg-white">
					<CardHeader class="border-b bg-muted/20">
						<CardTitle class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="text-blue-500"
							>
								<path d="m18 16 4-4-4-4"></path>
								<path d="m6 8-4 4 4 4"></path>
								<path d="m14.5 4-5 16"></path>
							</svg>
							Debug Information
						</CardTitle>
						<CardDescription
							>Technical details about the error to help troubleshoot the issue</CardDescription
						>
					</CardHeader>

					<CardContent class="space-y-6 p-5">
						<div>
							<h3 class="mb-2 text-sm font-semibold text-muted-foreground">User ID:</h3>
							<div class="overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
								{$user.id}
							</div>
						</div>

						<div>
							<h3 class="mb-2 text-sm font-semibold text-muted-foreground">Error Message:</h3>
							<div
								class="overflow-auto rounded-md border border-red-100 bg-red-50 p-3 font-mono text-sm text-red-800"
							>
								{JSON.stringify(debugInfo.error, null, 2)}
							</div>
						</div>

						<div>
							<h3 class="mb-2 text-sm font-semibold text-muted-foreground">Raw Course Data:</h3>
							<div class="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-sm">
								{JSON.stringify(debugInfo.rawData, null, 2)}
							</div>
						</div>

						<Separator />

						<div class="flex justify-center pt-2">
							<a href="/debug">
								<Button variant="outline" class="flex items-center gap-2">
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
											d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"
										></path>
									</svg>
									Go to Debug Page
								</Button>
							</a>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	{:else}
		<!-- Course Content -->
		{#if activeCourses.length === 0 && inactiveCourses.length === 0}
			<!-- No Courses State -->
			<div class="rounded-lg border-2 border-dashed bg-muted/5 py-16 text-center">
				<div class="mx-auto flex max-w-md flex-col items-center">
					<div
						class="mb-6 flex size-20 items-center justify-center rounded-full border border-blue-200 bg-blue-50"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="30"
							height="30"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="text-blue-500"
						>
							<path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2h-4a2 2 0 0 0 1-1.5"></path>
							<path d="M12 6h-3a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h5c.27 0 .5-.5.5-.5"></path>
							<path d="M3 15h6"></path>
							<path d="m7 19-4-4 4-4"></path>
						</svg>
					</div>
					<h2 class="mb-3 text-2xl font-semibold">No courses found</h2>
					<p class="mb-8 text-muted-foreground">
						You aren't enrolled in any courses yet. Please contact your administrator to get
						started.
					</p>

					<a href="/debug">
						<Button variant="outline">Go to Debug Page</Button>
					</a>
				</div>
			</div>
		{:else}
			<!-- Tabs for Course Types -->
			<Tabs
				value={activeTab}
				class="mb-6"
				onValueChange={(value) => (activeTab = value as 'active' | 'inactive' | 'all')}
			>
				<TabsList class="mb-8 grid w-full grid-cols-3 md:w-auto">
					<TabsTrigger
						value="all"
						class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
					>
						All Courses
						<Badge variant="outline" class="ml-2 bg-muted"
							>{activeCourses.length + inactiveCourses.length}</Badge
						>
					</TabsTrigger>
					<TabsTrigger
						value="active"
						class="data-[state=active]:bg-green-600 data-[state=active]:text-white"
					>
						Active
						<Badge variant="outline" class="ml-2 bg-muted">{activeCourses.length}</Badge>
					</TabsTrigger>
					<TabsTrigger
						value="inactive"
						class="data-[state=active]:bg-gray-500 data-[state=active]:text-white"
					>
						Archived
						<Badge variant="outline" class="ml-2 bg-muted">{inactiveCourses.length}</Badge>
					</TabsTrigger>
				</TabsList>

				<TabsContent value="all" class="mt-0">
					<!-- Combined View -->
					{#if searchTerm && filteredCourses.length === 0}
						<div class="rounded-lg border bg-muted/10 py-16 text-center">
							<div class="flex flex-col items-center">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/20">
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
								</div>
								<h3 class="mb-2 text-xl font-medium">No courses match your search</h3>
								<p class="mb-4 text-muted-foreground">Try adjusting your search terms</p>
								<Button variant="outline" onclick={() => (searchTerm = '')}>Clear Search</Button>
							</div>
						</div>
					{:else}
						{#if activeCourses.length > 0}
							<h2 class="mb-4 flex items-center text-xl font-semibold">
								<span class="mr-2 inline-block h-3 w-3 rounded-full bg-green-500"></span>
								Active Courses
							</h2>

							{#if viewMode === 'grid'}
								<div class="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
									{#each filteredCourses.filter((course) => course.is_active) as course, i (course.id)}
										<div
											class="transition-all duration-500"
											style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
										>
											<Card
												class={`h-full overflow-hidden border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${getCardColor(course.code, true)}`}
											>
												<CardHeader class="pb-3">
													<div class="flex items-start justify-between">
														<Badge variant="outline" class="text-xs font-normal">
															<span class="mr-1">{getTermIcon(course.term)}</span>
															{course.term}
														</Badge>

														{#if course.role}
															<Badge
																variant="secondary"
																class={`text-xs font-normal capitalize ${getRoleBadgeStyle(course.role)}`}
															>
																{course.role}
															</Badge>
														{/if}
													</div>
												</CardHeader>

												<CardContent class="pt-0">
													<h3 class="mb-1 text-sm text-gray-500">{course.code}</h3>
													<h4 class="mb-3 line-clamp-2 text-xl font-semibold">{course.name}</h4>

													{#if course.description}
														<p class="mb-6 line-clamp-2 text-sm text-muted-foreground">
															{course.description}
														</p>
													{/if}
												</CardContent>

												<CardFooter class="border-t pt-3">
													<a href="/courses/{course.id}" class="w-full">
														<Button variant="default" class="w-full font-medium">
															Enter Course
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
																class="ml-1"
															>
																<path d="m9 18 6-6-6-6"></path>
															</svg>
														</Button>
													</a>
												</CardFooter>
											</Card>
										</div>
									{/each}
								</div>
							{:else}
								<div class="mb-10 space-y-3">
									{#each filteredCourses.filter((course) => course.is_active) as course, i (course.id)}
										<div
											class="transition-all duration-500"
											style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
										>
											<a href="/courses/{course.id}" class="block">
												<Card
													class={`overflow-hidden border-l-4 border-green-500 transition-all duration-300 hover:shadow`}
												>
													<div class="flex flex-col p-4 md:flex-row md:items-center">
														<div class="mb-3 min-w-0 flex-1 md:mb-0 md:mr-4">
															<div class="mb-1 flex items-center gap-2">
																<Badge variant="outline" class="text-xs font-normal">
																	<span class="mr-1">{getTermIcon(course.term)}</span>
																	{course.term}
																</Badge>

																{#if course.role}
																	<Badge
																		variant="secondary"
																		class={`text-xs font-normal capitalize ${getRoleBadgeStyle(course.role)}`}
																	>
																		{course.role}
																	</Badge>
																{/if}
															</div>

															<h3 class="text-sm text-gray-500">{course.code}</h3>
															<h4 class="truncate text-lg font-semibold">{course.name}</h4>
														</div>

														<Button variant="default" size="sm" class="self-end md:self-auto">
															Enter Course
														</Button>
													</div>
												</Card>
											</a>
										</div>
									{/each}
								</div>
							{/if}
						{/if}

						{#if inactiveCourses.length > 0 && filteredCourses.some((c) => !c.is_active)}
							<h2 class="mb-4 flex items-center text-xl font-semibold">
								<span class="mr-2 inline-block h-3 w-3 rounded-full bg-gray-400"></span>
								Archived Courses
							</h2>

							{#if viewMode === 'grid'}
								<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
									{#each filteredCourses.filter((course) => !course.is_active) as course, i (course.id)}
										<div
											class="transition-all duration-500"
											style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
										>
											<Card
												class={`h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-sm ${getCardColor(course.code, false)}`}
											>
												<CardHeader class="pb-3">
													<div class="flex items-start justify-between">
														<Badge variant="outline" class="text-xs font-normal opacity-70">
															<span class="mr-1">{getTermIcon(course.term)}</span>
															{course.term}
														</Badge>

														{#if course.role}
															<Badge
																variant="outline"
																class="text-xs font-normal capitalize opacity-70"
															>
																{course.role}
															</Badge>
														{/if}
													</div>
												</CardHeader>

												<CardContent class="pt-0">
													<h3 class="mb-1 text-sm text-gray-500">{course.code}</h3>
													<h4 class="mb-3 line-clamp-2 text-xl font-semibold text-muted-foreground">
														{course.name}
													</h4>

													{#if course.description}
														<p class="mb-6 line-clamp-2 text-sm text-muted-foreground opacity-70">
															{course.description}
														</p>
													{/if}
												</CardContent>

												<CardFooter class="border-t pt-3">
													<a href="/courses/{course.id}" class="w-full">
														<Button variant="outline" class="w-full opacity-80">
															View Archive
														</Button>
													</a>
												</CardFooter>
											</Card>
										</div>
									{/each}
								</div>
							{:else}
								<div class="space-y-3">
									{#each filteredCourses.filter((course) => !course.is_active) as course, i (course.id)}
										<div
											class="transition-all duration-500"
											style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
										>
											<a href="/courses/{course.id}" class="block">
												<Card
													class="overflow-hidden border-l-4 border-gray-300 transition-all duration-300 hover:shadow-sm"
												>
													<div class="flex flex-col p-4 md:flex-row md:items-center">
														<div class="mb-3 min-w-0 flex-1 md:mb-0 md:mr-4">
															<div class="mb-1 flex items-center gap-2">
																<Badge variant="outline" class="text-xs font-normal opacity-70">
																	<span class="mr-1">{getTermIcon(course.term)}</span>
																	{course.term}
																</Badge>

																{#if course.role}
																	<Badge
																		variant="outline"
																		class="text-xs font-normal capitalize opacity-70"
																	>
																		{course.role}
																	</Badge>
																{/if}
															</div>

															<h3 class="text-sm text-gray-500">{course.code}</h3>
															<h4 class="truncate text-lg font-semibold text-muted-foreground">
																{course.name}
															</h4>
														</div>

														<Button
															variant="outline"
															size="sm"
															class="self-end opacity-80 md:self-auto"
														>
															View Archive
														</Button>
													</div>
												</Card>
											</a>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					{/if}
				</TabsContent>

				<TabsContent value="active" class="mt-0">
					<!-- Active Courses -->
					{#if searchTerm && filteredCourses.length === 0}
						<div class="rounded-lg border bg-muted/10 py-16 text-center">
							<div class="flex flex-col items-center">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/20">
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
								</div>
								<h3 class="mb-2 text-xl font-medium">No active courses match your search</h3>
								<p class="mb-4 text-muted-foreground">Try adjusting your search terms</p>
								<Button variant="outline" onclick={() => (searchTerm = '')}>Clear Search</Button>
							</div>
						</div>
					{:else if activeCourses.length === 0}
						<div class="rounded-lg border border-dashed bg-muted/10 py-16 text-center">
							<div class="flex flex-col items-center">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/30">
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
										<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
										<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
									</svg>
								</div>
								<h3 class="mb-2 text-xl font-medium">No active courses</h3>
								<p class="mb-6 text-muted-foreground">You are not enrolled in any active courses</p>
							</div>
						</div>
					{:else if viewMode === 'grid'}
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{#each filteredCourses as course, i (course.id)}
								<div
									class="transition-all duration-500"
									style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
								>
									<Card
										class={`h-full overflow-hidden border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${getCardColor(course.code, true)}`}
									>
										<CardHeader class="pb-3">
											<div class="flex items-start justify-between">
												<Badge variant="outline" class="text-xs font-normal">
													<span class="mr-1">{getTermIcon(course.term)}</span>
													{course.term}
												</Badge>

												{#if course.role}
													<Badge
														variant="secondary"
														class={`text-xs font-normal capitalize ${getRoleBadgeStyle(course.role)}`}
													>
														{course.role}
													</Badge>
												{/if}
											</div>
										</CardHeader>

										<CardContent class="pt-0">
											<h3 class="mb-1 text-sm text-gray-500">{course.code}</h3>
											<h4 class="mb-3 line-clamp-2 text-xl font-semibold">{course.name}</h4>

											{#if course.description}
												<p class="mb-6 line-clamp-2 text-sm text-muted-foreground">
													{course.description}
												</p>
											{/if}
										</CardContent>

										<CardFooter class="border-t pt-3">
											<a href="/courses/{course.id}" class="w-full">
												<Button variant="default" class="w-full font-medium">
													Enter Course
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
														class="ml-1"
													>
														<path d="m9 18 6-6-6-6"></path>
													</svg>
												</Button>
											</a>
										</CardFooter>
									</Card>
								</div>
							{/each}
						</div>
					{:else}
						<div class="space-y-3">
							{#each filteredCourses as course, i (course.id)}
								<div
									class="transition-all duration-500"
									style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
								>
									<a href="/courses/{course.id}" class="block">
										<Card
											class="overflow-hidden border-l-4 border-green-500 transition-all duration-300 hover:shadow"
										>
											<div class="flex flex-col p-4 md:flex-row md:items-center">
												<div class="mb-3 min-w-0 flex-1 md:mb-0 md:mr-4">
													<div class="mb-1 flex items-center gap-2">
														<Badge variant="outline" class="text-xs font-normal">
															<span class="mr-1">{getTermIcon(course.term)}</span>
															{course.term}
														</Badge>

														{#if course.role}
															<Badge
																variant="secondary"
																class={`text-xs font-normal capitalize ${getRoleBadgeStyle(course.role)}`}
															>
																{course.role}
															</Badge>
														{/if}
													</div>

													<h3 class="text-sm text-gray-500">{course.code}</h3>
													<h4 class="truncate text-lg font-semibold">{course.name}</h4>
												</div>

												<Button variant="default" size="sm" class="self-end md:self-auto">
													Enter Course
												</Button>
											</div>
										</Card>
									</a>
								</div>
							{/each}
						</div>
					{/if}
				</TabsContent>

				<TabsContent value="inactive" class="mt-0">
					<!-- Inactive Courses -->
					{#if searchTerm && filteredCourses.length === 0}
						<div class="rounded-lg border bg-muted/10 py-16 text-center">
							<div class="flex flex-col items-center">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/20">
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
								</div>
								<h3 class="mb-2 text-xl font-medium">No archived courses match your search</h3>
								<p class="mb-4 text-muted-foreground">Try adjusting your search terms</p>
								<Button variant="outline" onclick={() => (searchTerm = '')}>Clear Search</Button>
							</div>
						</div>
					{:else if inactiveCourses.length === 0}
						<div class="rounded-lg border border-dashed bg-muted/10 py-16 text-center">
							<div class="flex flex-col items-center">
								<div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/30">
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
										<rect width="20" height="5" x="2" y="3" rx="1"></rect>
										<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path>
										<path d="M10 12h4"></path>
									</svg>
								</div>
								<h3 class="mb-2 text-xl font-medium">No archived courses</h3>
								<p class="text-muted-foreground">Courses are archived at the end of the term</p>
							</div>
						</div>
					{:else if viewMode === 'grid'}
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{#each filteredCourses as course, i (course.id)}
								<div
									class="transition-all duration-500"
									style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
								>
									<Card
										class={`h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-sm ${getCardColor(course.code, false)}`}
									>
										<CardHeader class="pb-3">
											<div class="flex items-start justify-between">
												<Badge variant="outline" class="text-xs font-normal opacity-70">
													<span class="mr-1">{getTermIcon(course.term)}</span>
													{course.term}
												</Badge>

												{#if course.role}
													<Badge
														variant="outline"
														class="text-xs font-normal capitalize opacity-70"
													>
														{course.role}
													</Badge>
												{/if}
											</div>
										</CardHeader>

										<CardContent class="pt-0">
											<h3 class="mb-1 text-sm text-gray-500">{course.code}</h3>
											<h4 class="mb-3 line-clamp-2 text-xl font-semibold text-muted-foreground">
												{course.name}
											</h4>

											{#if course.description}
												<p class="mb-6 line-clamp-2 text-sm text-muted-foreground opacity-70">
													{course.description}
												</p>
											{/if}
										</CardContent>

										<CardFooter class="border-t pt-3">
											<a href="/courses/{course.id}" class="w-full">
												<Button variant="outline" class="w-full opacity-80">View Archive</Button>
											</a>
										</CardFooter>
									</Card>
								</div>
							{/each}
						</div>
					{:else}
						<div class="space-y-3">
							{#each filteredCourses as course, i (course.id)}
								<div
									class="transition-all duration-500"
									style="animation: fadeIn {i * 100 + 200}ms ease-out forwards"
								>
									<a href="/courses/{course.id}" class="block">
										<Card
											class="overflow-hidden border-l-4 border-gray-300 transition-all duration-300 hover:shadow-sm"
										>
											<div class="flex flex-col p-4 md:flex-row md:items-center">
												<div class="mb-3 min-w-0 flex-1 md:mb-0 md:mr-4">
													<div class="mb-1 flex items-center gap-2">
														<Badge variant="outline" class="text-xs font-normal opacity-70">
															<span class="mr-1">{getTermIcon(course.term)}</span>
															{course.term}
														</Badge>

														{#if course.role}
															<Badge
																variant="outline"
																class="text-xs font-normal capitalize opacity-70"
															>
																{course.role}
															</Badge>
														{/if}
													</div>

													<h3 class="text-sm text-gray-500">{course.code}</h3>
													<h4 class="truncate text-lg font-semibold text-muted-foreground">
														{course.name}
													</h4>
												</div>

												<Button
													variant="outline"
													size="sm"
													class="self-end opacity-80 md:self-auto"
												>
													View Archive
												</Button>
											</div>
										</Card>
									</a>
								</div>
							{/each}
						</div>
					{/if}
				</TabsContent>
			</Tabs>
		{/if}
	{/if}
</div>

<style>
	@keyframes fadeIn {
		0% {
			opacity: 0;
			transform: translateY(10px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
