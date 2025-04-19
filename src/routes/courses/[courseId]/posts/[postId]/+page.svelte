<!-- src/routes/courses/[courseId]/posts/[postId]/+page.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
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
	import { Textarea } from '$lib/components/ui/textarea';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	// Import markdown parser with syntax highlighting
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import hljs from 'highlight.js/lib/common'; // Import highlight.js styles in your +layout.svelte or here (if not globally imported)
	import 'highlight.js/styles/atom-one-light.css';
	import { markedHighlight } from 'marked-highlight';
	import { SmilePlus } from 'lucide-svelte';
	import {SquareScissors} from 'lucide-svelte'; // Import icons from lucide-svelte
	import {Send} from 'lucide-svelte';

	// Configure marked with syntax highlighting

	marked.use(
		markedHighlight({
			highlight: (code, lang) => {
				if (lang && hljs.getLanguage(lang)) {
					try {
						return hljs.highlight(code, { language: lang }).value;
					} catch (err) {
						console.error(err);
					}
				}
				return hljs.highlightAuto(code).value;
			}
		})
	);

	marked.setOptions({
		gfm: true,
		breaks: true
	});

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
	let sortOption: 'newest' | 'oldest' | 'endorsed' | 'upvotes' = 'oldest';
	let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

	// Session check to avoid expired token issues
	function setupSessionCheck() {
		// Clear any existing interval
		if (sessionCheckInterval) {
			clearInterval(sessionCheckInterval);
		}

		// Set up a new check every 5 minutes
		sessionCheckInterval = setInterval(
			async () => {
				if ($user) {
					// Refresh the session
					const { data, error } = await supabase.auth.refreshSession();
					if (error) {
						console.error('Session refresh failed:', error);
						alert('Your session has expired. Please refresh the page to continue.');
						clearInterval(sessionCheckInterval!);
					} else {
						console.log('Session refreshed successfully');
					}
				}
			},
			5 * 60 * 1000
		); // 5 minutes
	}

	onMount(async () => {
		if (!$user) {
			const { data } = await supabase.auth.getSession();

			if (!data.session) {
				console.log('No authenticated user found, redirecting to login');
				const currentPath = window.location.pathname;
				window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
				return; // Stop further execution
			}
		}

		// Set up periodic session check
		setupSessionCheck();

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
			// Get post author info
			console.log('Post anonymous status:', postData.anonymous, typeof postData.anonymous);
			console.log('Post user_id:', postData.user_id);

			if (!postData.anonymous) {
				const { data: userData, error: userError } = await supabase
					.from('users')
					.select('id, full_name, role')
					.eq('id', postData.user_id)
					.single();

				console.log('User data fetch result:', userData, userError);

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
				const enhancedResponses = await Promise.all(
					responseData.map(async (response) => {
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
						// Get comments
						const { data: comments, error: commentsError } = await supabase
							.from('comments')
							.select('*')
							.eq('response_id', response.id)
							.order('created_at', { ascending: true });

						if (commentsError) {
							console.error('Error loading comments:', commentsError);
							response.comments = [];
						} else if (comments) {
							// Fetch user data for each comment
							const enhancedComments = await Promise.all(
								comments.map(async (comment) => {
									if (!comment.anonymous) {
										const { data: userData, error: userError } = await supabase
											.from('users')
											.select('id, full_name, role') // No avatar_url
											.eq('id', comment.user_id)
											.single();

										if (!userError && userData) {
											return {
												...comment,
												users: userData
											};
										}
									}
									return comment;
								})
							);

							response.comments = enhancedComments as CommentData[];
						} else {
							response.comments = [];
						}

						return response as ResponseData;
					})
				);

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
				await supabase.from('post_views').upsert(
					{
						post_id: postId,
						user_id: $user.id,
						last_viewed_at: new Date().toISOString()
					},
					{ onConflict: 'post_id,user_id' }
				);
			}
		} catch (err) {
			console.error('Error in onMount:', err);
		} finally {
			loading = false;
		}

		// Clean up function
		return () => {
			if (sessionCheckInterval) {
				clearInterval(sessionCheckInterval);
			}
		};
	});

	function sortResponses() {
		if (sortOption === 'newest') {
			responses = [...responses].sort(
				(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		} else if (sortOption === 'oldest') {
			responses = [...responses].sort(
				(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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

			// Refresh auth session before submitting
			const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
			if (sessionError || !sessionData.session) {
				console.error('Session error before submitting:', sessionError);
				alert('Your session has expired. Please refresh the page to continue.');
				submitting = false;
				return;
			}

			const responseType = currentUserRole === 'student' ? 'student_answer' : 'instructor_answer';

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

				// Check if it's an auth error and handle accordingly
				if (error.code === '401' || error.message.includes('auth')) {
					alert('Your session has expired. Please refresh the page to continue.');
				}

				return;
			}

			if (data && data.length > 0) {
				// Add the new response to the list
				const newResponseData: ResponseData = {
					...data[0],
					user: $user
						? {
								id: $user.id,
								full_name: $user.full_name || 'User',
								role: currentUserRole
							}
						: undefined,
					upvote_count: 0,
					comments: []
				};

				responses = [newResponseData, ...responses];

				// Clear the form
				newResponse = '';
				previewMode = false;

				// Update post status if this is the first response from an instructor
				if (
					(responseType === 'instructor_answer' || currentUserRole === 'ta') &&
					post &&
					post.status === 'open'
				) {
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
			// Check session validity first
			const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
			if (sessionError || !sessionData.session) {
				console.error('Session error before endorsing:', sessionError);
				alert('Your session has expired. Please refresh the page to continue.');
				return;
			}

			const targetResponse = responses.find((r) => r.id === responseId);
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

				// Check if it's an auth error
				if (error.code === '401' || error.message.includes('auth')) {
					alert('Your session has expired. Please refresh the page to continue.');
				}

				return;
			}

			// Update local state
			responses = responses.map((r) =>
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
			// Check session validity first
			const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
			if (sessionError || !sessionData.session) {
				console.error('Session error before upvoting:', sessionError);
				alert('Your session has expired. Please refresh the page to continue.');
				return;
			}

			const targetResponse = responses.find((r) => r.id === responseId);
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

					// Check if it's an auth error
					if (deleteError.code === '401' || deleteError.message.includes('auth')) {
						alert('Your session has expired. Please refresh the page to continue.');
					}

					return;
				}

				// Update local state
				responses = responses.map((r) =>
					r.id === responseId
						? {
								...r,
								upvote_count: Math.max(0, r.upvote_count - 1),
								userUpvoted: false
							}
						: r
				);
			} else {
				// Add upvote
				const { error: insertError } = await supabase.from('reactions').insert({
					user_id: $user.id,
					target_type: 'response',
					target_id: responseId,
					reaction_type: 'upvote'
				});

				if (insertError) {
					console.error('Error adding upvote:', insertError);

					// Check if it's an auth error
					if (insertError.code === '401' || insertError.message.includes('auth')) {
						alert('Your session has expired. Please refresh the page to continue.');
					}

					return;
				}

				// Update local state
				responses = responses.map((r) =>
					r.id === responseId
						? {
								...r,
								upvote_count: r.upvote_count + 1,
								userUpvoted: true
							}
						: r
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
			// Check session validity first
			const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
			if (sessionError || !sessionData.session) {
				console.error('Session error before commenting:', sessionError);
				alert('Your session has expired. Please refresh the page to continue.');
				commentSubmitting = false;
				return;
			}

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

				// Check if it's an auth error
				if (error.code === '401' || error.message.includes('auth')) {
					alert('Your session has expired. Please refresh the page to continue.');
				}

				return;
			}

			if (data && data.length > 0) {
				// Add comment to local state
				const newComment: CommentData = {
					...data[0],
					users: isAnonymous
						? undefined
						: {
								id: $user.id,
								full_name: $user.full_name || 'User',
								role: currentUserRole
							}
				};

				// Update responses
				responses = responses.map((r) => {
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
				'span',
				'del',
				'ins',
				'sup',
				'sub',
				'mark',
				'ruby',
				'rt',
				'rp',
				'abbr',
				'cite'
			],
			ALLOWED_ATTR: [
				'href',
				'name',
				'target',
				'src',
				'alt',
				'class',
				'id',
				'style',
				'title',
				'lang',
				'width',
				'height',
				'data-language'
			],
			ALLOW_DATA_ATTR: true
		};

		try {
			// Parse markdown with marked
			const parsed = marked.parse(content, {
				gfm: true,
				breaks: true
			});

			// Sanitize the HTML
			const sanitized = DOMPurify.sanitize(parsed, sanitizeOptions);

			return sanitized;
		} catch (error) {
			console.error('Error rendering markdown:', error);
			return DOMPurify.sanitize(content, sanitizeOptions);
		}
	}

	function getInitials(name: string | undefined): string {
		if (!name) return 'U';
		return name
			.split(' ')
			.map((n) => n[0])
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

	function getStatusBadge(status: string): { color: string; text: string; icon: string } {
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

<div class="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
		</div>
	{:else if post}
		<!-- Breadcrumb -->
		<div class="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
			<a href="/courses" class="transition-colors hover:text-primary">Courses</a>
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
				class="mx-1"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
			<a href="/courses/{courseId}" class="transition-colors hover:text-primary"
				>{post.courses?.code || 'Course'}</a
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
				class="mx-1"
			>
				<polyline points="9 18 15 12 9 6"></polyline>
			</svg>
			<span class="truncate font-medium">{post.title}</span>
		</div>

		<!-- Question Card -->
		<Card class="mb-8 overflow-hidden shadow-sm">
			<CardHeader class="border-b bg-muted/20 pb-4">
				<div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<div class="flex items-center gap-2">
						<!-- Fix: Use proper svelte binding syntax for dynamic HTML -->
						<span class="inline-block">
							{@html getPostTypeIcon(post.post_type)}
						</span>

						{#if post.status}
							<Badge
								variant="outline"
								class={`flex items-center gap-1 ${getStatusBadge(post.status).color}`}
							>
								<span>{@html getStatusBadge(post.status).icon}</span>
								<span>{getStatusBadge(post.status).text}</span>
							</Badge>
						{/if}

						{#if post.folder_name}
							<Badge variant="secondary" class="flex items-center gap-1">
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
										d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
									></path>
								</svg>
								<span>{post.folder_name}</span>
							</Badge>
						{/if}
					</div>

					<div class="flex gap-2">
						<a href="/courses/{courseId}" class="inline-flex">
							<Button variant="ghost" size="sm" class="h-8 gap-1">
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
									<path d="m15 18-6-6 6-6"></path>
								</svg>
								<span>Back to Course</span>
							</Button>
						</a>
					</div>
				</div>

				<CardTitle class="mt-2 text-2xl">{post.title}</CardTitle>
			</CardHeader>

			<CardContent class="py-6">
				<div class="mb-4 flex items-center gap-3">
					<Avatar class="h-9 w-9 border">
						<AvatarFallback
							class={post.anonymous !== true && post.user?.role === 'instructor'
								? 'bg-amber-100 text-amber-700'
								: post.anonymous !== true && post.user?.role === 'ta'
									? 'bg-purple-100 text-purple-700'
									: 'bg-muted'}
						>
							{post.anonymous === true ? 'A' : post.user ? getInitials(post.user.full_name) : 'U'}
						</AvatarFallback>
					</Avatar>

					<div>
						<div class="flex items-center gap-1 text-sm font-medium">
							<span>
								{post.anonymous
									? 'Anonymous'
									: post.user
										? post.user.full_name
										: `User (ID: ${post.user_id})`}
							</span>
							{#if !post.anonymous && post.user?.role}
								<Badge
									variant={post.user?.role === 'instructor'
										? 'default'
										: post.user?.role === 'ta'
											? 'secondary'
											: 'outline'}
									class="h-4 px-1.5 py-0 text-[10px] font-normal"
								>
									{post.user?.role === 'instructor'
										? 'Instructor'
										: post.user?.role === 'ta'
											? 'TA'
											: 'Student'}
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

				<div class="prose prose-stone dark:prose-invert max-w-none break-words">
					{@html renderMarkdown(post.content)}
				</div>
			</CardContent>
		</Card>

		<!-- Responses Section -->
		<div class="mb-8">
			<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-xl font-semibold">
					{responses.length}
					{responses.length === 1 ? 'Response' : 'Responses'}
				</h2>

				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">Sort by:</span>
					<div class="flex overflow-hidden rounded-md border">
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
							<CardHeader class="flex flex-row items-start justify-between pb-3">
								<div class="flex items-center gap-3">
									<Avatar class="h-9 w-9 border">
										<AvatarFallback
											class={!response.anonymous && response.user?.role === 'instructor'
												? 'bg-amber-100 text-amber-700'
												: !response.anonymous && response.user?.role === 'ta'
													? 'bg-purple-100 text-purple-700'
													: 'bg-muted'}
										>
											{response.anonymous ? 'A' : getInitials(response.user?.full_name)}
										</AvatarFallback>
									</Avatar>

									<div>
										<div class="flex items-center gap-1 text-sm font-medium">
											<span
												>{response.anonymous
													? 'Anonymous'
													: response.user?.full_name || 'User'}</span
											>
											{#if !response.anonymous && response.user?.role}
												<Badge
													variant={response.user?.role === 'instructor'
														? 'default'
														: response.user?.role === 'ta'
															? 'secondary'
															: 'outline'}
													class="h-4 px-1.5 py-0 text-[10px] font-normal"
												>
													{response.user?.role === 'instructor'
														? 'Instructor'
														: response.user?.role === 'ta'
															? 'TA'
															: 'Student'}
												</Badge>
											{/if}
										</div>
										<p class="text-xs text-muted-foreground">
											{formatDate(response.created_at)}
										</p>
									</div>
								</div>

								{#if response.is_endorsed}
									<Badge
										variant="default"
										class="flex items-center gap-1 bg-green-500 px-2 text-white hover:bg-green-600"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="m9 11-5 5 1.5 1.5L10 13"></path>
											<path d="m19 7-8.5 8.5L7 12"></path>
										</svg>
										Endorsed
									</Badge>
								{/if}
							</CardHeader>

							<CardContent class="pb-3">
								<div class="prose prose-stone dark:prose-invert max-w-none break-words">
									{@html renderMarkdown(response.content)}
								</div>
							</CardContent>

							<CardFooter class="flex flex-wrap justify-between gap-2 border-t pt-3">
								<div class="flex items-center gap-2">
									<Button
										variant={response.userUpvoted ? 'default' : 'outline'}
										size="sm"
										class={`h-8 px-3 ${response.userUpvoted ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}
										onclick={() => upvoteResponse(response.id)}
									>
										{#if response.userUpvoted}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="currentColor"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="mr-1"
											>
												<path d="m6 14 8-8 8 8"></path>
											</svg>
										{:else}
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
												class="mr-1"
											>
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
											class="mr-1"
										>
											<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
											></path>
										</svg>
										<span>{response.comments ? response.comments.length : 0}</span>
									</Button>
								</div>

								{#if $user && (currentUserRole === 'instructor' || currentUserRole === 'ta')}
									<Button
										variant={response.is_endorsed ? 'outline' : 'ghost'}
										size="sm"
										class={response.is_endorsed
											? 'border-green-300 text-green-700 hover:bg-green-50'
											: ''}
										onclick={() => {
											responseToEndorse = response;
											endorseConfirmOpen = true;
										}}
									>
										{#if response.is_endorsed}
										<SquareScissors />
											Remove Endorsement
										{:else}
										<SmilePlus />
											Endorse
										{/if}
									</Button>
								{/if}
							</CardFooter>

							<!-- Comments Section -->
							{#if response.comments && response.comments.length > 0}
								<div class="px-6 pb-4 pt-0">
									<Separator class="mb-3" />
									<div class="ml-6 space-y-3 border-l-2 border-muted pl-4">
										{#each response.comments as comment (comment.id)}
											<div class="text-sm">
												<div class="mb-1 flex items-center gap-2">
													<Avatar class="h-6 w-6">
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
													<p class="break-words text-muted-foreground">{comment.content}</p>
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
												class="resize-none text-sm"
												disabled={commentSubmitting}
											/>
										</div>
										<div class="mt-2 flex items-center justify-between">
											<div class="flex items-center">
												<Checkbox id={`anon-comment-${response.id}`} bind:checked={isAnonymous} />
												<label for={`anon-comment-${response.id}`} class="ml-2 text-xs"
													>Post anonymously</label
												>
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
					<div class="px-4 py-10 text-center">
						<div
							class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted/30"
						>
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
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
							</svg>
						</div>
						<h3 class="mb-1 text-lg font-semibold">No responses yet</h3>
						<p class="mx-auto mb-6 max-w-md text-muted-foreground">
							Be the first to respond to this {post.post_type}!
						</p>
					</div>
				</Card>
			{/if}
		</div>

		<!-- New Response Form -->
		{#if $user}
			<Card id="respond">
				<CardHeader class="pb-3">
					<CardTitle class="text-lg">Your Response</CardTitle>
					<CardDescription
						>Respond to this {post.post_type}. You can use Markdown for formatting.</CardDescription
					>
				</CardHeader>

				<!-- Editor Tabs -->
				<div class="px-6">
					<Tabs.Root value={previewMode ? 'preview' : 'write'}>
						<Tabs.List class="w-full">
							<Tabs.Trigger value="write" class="flex-1" onclick={() => (previewMode = false)}>
								Write
							</Tabs.Trigger>
							<Tabs.Trigger value="preview" class="flex-1" onclick={() => (previewMode = true)}>
								Preview
							</Tabs.Trigger>
						</Tabs.List>

						<Tabs.Content
							value="write"
							class="pt-4 focus-visible:outline-none focus-visible:ring-0"
						>
							<Textarea
								bind:value={newResponse}
								placeholder="Write your response here... You can use Markdown for formatting"
								rows={6}
								class="min-h-[150px] resize-y"
								disabled={submitting}
							/>
							<div class="mt-2 text-xs text-muted-foreground">
								<strong>Tip:</strong> You can use Markdown to format your text. For code blocks, use
								```python (or another language) to add syntax highlighting.
							</div>
						</Tabs.Content>

						<Tabs.Content
							value="preview"
							class="pt-4 focus-visible:outline-none focus-visible:ring-0"
						>
							{#if newResponse.trim()}
								<div
									class="prose prose-stone dark:prose-invert min-h-[150px] max-w-none break-words rounded-md border p-4"
								>
									{@html renderMarkdown(newResponse)}
								</div>
							{:else}
								<div
									class="flex min-h-[150px] items-center justify-center rounded-md border p-4 text-muted-foreground"
								>
									<p>Nothing to preview</p>
								</div>
							{/if}
						</Tabs.Content>
					</Tabs.Root>
				</div>

				<CardFooter class="mt-4 flex items-center justify-between border-t pt-5">
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
							<svg
								class="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span>Posting...</span>
						{:else}
						<Send />
							<span>Post Response</span>
						{/if}
					</Button>
				</CardFooter>
			</Card>
		{:else}
			<Card>
				<CardContent class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted/30"
					>
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
							class="text-muted-foreground"
						>
							<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
							<circle cx="12" cy="7" r="4"></circle>
						</svg>
					</div>
					<h3 class="mb-2 text-lg font-medium">Sign in to respond</h3>
					<p class="mx-auto mb-4 max-w-md text-muted-foreground">
						Join the discussion by signing in to your account
					</p>
					<a href={`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`}>
						<Button variant="default">Sign In</Button>
					</a>
				</CardContent>
			</Card>
		{/if}
	{:else}
		<!-- Not Found State -->
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-6 flex size-20 items-center justify-center rounded-full bg-muted/50">
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
					class="text-muted-foreground"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<path d="M12 8v4"></path>
					<path d="M12 16h.01"></path>
				</svg>
			</div>
			<h2 class="mb-2 text-2xl font-semibold">Post Not Found</h2>
			<p class="mb-6 max-w-md text-muted-foreground">
				The post you're looking for may have been removed or you don't have permission to view it.
			</p>
			<a href="/courses/{courseId}">
				<Button variant="outline">Back to Course</Button>
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
					Endorsing indicates this response correctly addresses the question. This may mark the post
					as answered.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (endorseConfirmOpen = false)}>Cancel</AlertDialog.Cancel>
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

<!-- Add these styles to properly handle code blocks and text overflow -->
<style>
	/* Make sure pre blocks don't overflow */
	:global(pre) {
		max-width: 100%;
		overflow-x: auto;
		padding: 1rem;
		background-color: #f5f5f5; /* Change to a light background color like a light grey or white */
		border-radius: 0.375rem;
		margin: 1rem 0;
	}

	/* Code block styling */
	:global(code) {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.875rem;
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
	}

	:global(:not(pre) > code) {
		background-color: rgba(0, 0, 0, 0.05);
		color: #ef4444;
		padding: 0.2em 0.4em;
	}

	/* Handling long words and URLs */
	:global(.prose p, .prose li) {
		overflow-wrap: break-word;
		word-wrap: break-word;
		word-break: break-word;
		hyphens: auto;
	}

	/* Table styling */
	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		overflow-x: auto;
		display: block;
	}

	:global(.prose th, .prose td) {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	/* Highlight.js theme override */
	:global(.hljs) {
		background: #f5f5f5 !important; /* Ensure this matches your intended pre background */
		color: #383a42 !important; /* Adjust text color to ensure readability */
		border-radius: 0.375rem;
	}

	:global(.hljs-keyword, .hljs-selector-tag, .hljs-tag) {
		color: #569cd6 !important;
	}

	:global(.hljs-attr, .hljs-name) {
		color: #9cdcfe !important;
	}

	:global(.hljs-string) {
		color: #ce9178 !important;
	}

	:global(.hljs-built_in, .hljs-builtin-name) {
		color: #4ec9b0 !important;
	}

	:global(.hljs-comment) {
		color: #6a9955 !important;
	}

	:global(.hljs-number) {
		color: #b5cea8 !important;
	}
</style>
