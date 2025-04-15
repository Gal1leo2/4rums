// src/lib/stores/auth.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';

// Define the user store type
export type UserData = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  user_metadata?: Record<string, any>;
} | null;

// Create a writable store for the user
export const user = writable<UserData>(null);

// Flag to track if auth has been initialized
let isInitialized = false;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;
const INIT_TIMEOUT = 2000; // 2 seconds timeout

// Track active auth subscriptions
let activeSubscription: { unsubscribe: () => void } | null = null;

// Generate a unique tab ID to prevent cross-tab interference
const tabId = Math.random().toString(36).substring(2, 15);

/**
 * Initialize the authentication state
 * Fetches the current session and updates the user store
 * Now with timeout and retry logic
 */
export async function initAuth(forceRefresh = false) {
  // Track initialization attempts
  initAttempts++;
  
  // Prevent multiple initializations unless forced
  if (isInitialized && !forceRefresh) {
    console.log(`[Tab ${tabId}] Auth already initialized, skipping`);
    return;
  }
  
  console.log(`[Tab ${tabId}] Initializing auth system (attempt ${initAttempts})`);
  
  // Create a promise that will reject after the timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Auth initialization timed out")), INIT_TIMEOUT);
  });
  
  try {
    // Race between the actual initialization and the timeout
    await Promise.race([
      timeoutPromise,
      initializeAuth()
    ]);
    
    // If we get here, initialization succeeded
    isInitialized = true;
    initAttempts = 0;
    console.log(`[Tab ${tabId}] Auth initialization completed successfully`);
    
    // Clean up any existing subscription
    if (activeSubscription) {
      console.log(`[Tab ${tabId}] Cleaning up existing auth subscription`);
      activeSubscription.unsubscribe();
    }
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Tab ${tabId}] Auth state change event:`, event);
      
      // Ignore events that shouldn't impact this tab
      // This reduces unnecessary processing across multiple tabs
      if (event === 'SIGNED_IN' && session) {
        console.log(`[Tab ${tabId}] SIGNED_IN event received, user ID:`, session.user.id);
        // await syncUserWithDatabase(session.user);
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        console.log(`[Tab ${tabId}] SIGNED_OUT event received`);
        user.set(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // On token refresh, we might want to update the user data
        console.log(`[Tab ${tabId}] TOKEN_REFRESHED event received`);
        await syncUserWithDatabase(session.user);
      }
    });
    
    // Store the active subscription for later cleanup
    activeSubscription = subscription;
    
    // Return the unsubscribe function for cleanup
    return () => {
      console.log(`[Tab ${tabId}] Unsubscribing from auth events`);
      subscription.unsubscribe();
      activeSubscription = null;
    };
  } catch (error) {
    console.error(`[Tab ${tabId}] Auth initialization failed:`, error);
    
    // If we've reached max attempts, give up and set user to null
    if (initAttempts >= MAX_INIT_ATTEMPTS) {
      console.error(`[Tab ${tabId}] Failed to initialize auth after ${MAX_INIT_ATTEMPTS} attempts`);
      user.set(null);
      return;
    }
    
    // Otherwise, retry after a short delay
    console.log(`[Tab ${tabId}] Retrying auth initialization in 500ms...`);
    setTimeout(() => initAuth(true), 500);
  }
}

/**
 * Actual authentication initialization logic
 * Separated to support the timeout mechanism
 */
async function initializeAuth() {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    console.log(`[Tab ${tabId}] Session found during init, user ID:`, session.user.id);
    await syncUserWithDatabase(session.user);
  } else {
    console.log(`[Tab ${tabId}] No session found during init`);
    user.set(null);
  }
}

/**
 * Synchronizes Supabase Auth user with the users table
 * @param authUser - The user object from Supabase Auth
 */
async function syncUserWithDatabase(authUser: any) {
  if (!authUser || !authUser.id || !authUser.email) {
    console.error(`[Tab ${tabId}] Invalid auth user data for sync:`, authUser);
    return;
  }

  try {
    console.log(`[Tab ${tabId}] Syncing user ${authUser.id} with database`);
    
    // Check if user already exists in the users table
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (fetchError) {
      if (fetchError.code !== 'PGRST116') { // PGRST116 is "row not found"
        console.error(`[Tab ${tabId}] Error checking user existence:`, fetchError);
      } else {
        console.log(`[Tab ${tabId}] User does not exist in database yet`);
      }
      
      // Continue with creation logic below
    } else {
      console.log(`[Tab ${tabId}] User found in database:`, existingUser.id);
      
      // User exists, update the store with database info
      user.set({
        id: existingUser.id,
        email: existingUser.email,
        full_name: existingUser.full_name,
        role: existingUser.role,
        user_metadata: authUser.user_metadata
      });
      
      // Update their last login - but only occasionally to reduce DB writes across tabs
      // Use the unique tab ID to create a deterministic pattern
      const shouldUpdateLastLogin = parseInt(tabId.substring(0, 2), 36) % 5 === 0;
      if (shouldUpdateLastLogin) {
        await supabase
          .from('users')
          .update({
            last_login: new Date().toISOString()
          })
          .eq('id', authUser.id);
      }
        
      return;
    }

    // User doesn't exist in our users table, create a new record
    
    // Determine role based on email or default to student
    let role = 'student';
    if (authUser.email === '66050977@kmitl.ac.th') {
      role = 'instructor';
    }
    
    console.log(`[Tab ${tabId}] Creating new user in database with role: ${role}`);
    
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
        role: role,
        hashed_password: 'not_used_for_login', // Placeholder for OAuth users
        last_login: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`[Tab ${tabId}] Error creating user in database:`, insertError);
      return;
    }
    
    console.log(`[Tab ${tabId}] New user created in database:`, newUser.id);
    
    // Update the store
    user.set({
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      user_metadata: authUser.user_metadata
    });
    
    // If this is a special role, also add them to appropriate courses
    if (role === 'instructor' || role === 'ta') {
      await setupSpecialUserCourses(authUser.id, role);
    }
  } catch (error) {
    console.error(`[Tab ${tabId}] Error in syncUserWithDatabase:`, error);
  }
}

/**
 * Setup course memberships for instructors and TAs
 * @param userId - The user ID
 * @param role - The user role (instructor or ta)
 */
async function setupSpecialUserCourses(userId: string, role: string) {
  try {
    console.log(`[Tab ${tabId}] Setting up course memberships for ${role} user: ${userId}`);
    
    // Get all active courses
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('is_active', true);
    
    if (courseError) {
      console.error(`[Tab ${tabId}] Error fetching courses for special user setup:`, courseError);
      return;
    }
    
    if (!courses || courses.length === 0) {
      console.log(`[Tab ${tabId}] No active courses found for special user setup`);
      return;
    }
    
    console.log(`[Tab ${tabId}] Found ${courses.length} active courses to enroll user in`);
    
    // Create course memberships for each course
    const memberships = courses.map(course => ({
      user_id: userId,
      course_id: course.id,
      role: role
    }));
    
    const { error: membershipError } = await supabase
      .from('course_members')
      .upsert(memberships, { 
        onConflict: 'course_id,user_id',
        ignoreDuplicates: false
      });
    
    if (membershipError) {
      console.error(`[Tab ${tabId}] Error setting up course memberships:`, membershipError);
    } else {
      console.log(`[Tab ${tabId}] Course memberships created successfully`);
    }
  } catch (error) {
    console.error(`[Tab ${tabId}] Error in setupSpecialUserCourses:`, error);
  }
}

/**
 * Signs in with email and password
 * @param email - User's email
 * @param password - User's password
 * @returns Result object with success flag and optional error
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    console.log(`[Tab ${tabId}] Attempting to sign in user: ${email}`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error(`[Tab ${tabId}] Sign in error:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`[Tab ${tabId}] Sign in successful, user:`, data.user?.id);
    return { success: true };
  } catch (error) {
    console.error(`[Tab ${tabId}] Exception during sign in:`, error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Signs in with Google OAuth
 * @param redirectTo - URL to redirect after successful login
 * @returns Result object with success flag and optional error
 */
export async function signInWithGoogle(redirectTo = '/courses') {
  try {
    console.log(`[Tab ${tabId}] Initiating Google sign in with redirect to: ${redirectTo}`);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback?redirectTo=' + encodeURIComponent(redirectTo)
      }
    });
    
    if (error) {
      console.error(`[Tab ${tabId}] Google sign in error:`, error);
      return { success: false, error: error.message };
    }
    
    console.log(`[Tab ${tabId}] Google sign in flow initiated`);
    return { success: true };
  } catch (error) {
    console.error(`[Tab ${tabId}] Exception during Google sign in:`, error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Signs the user out
 */
export async function signOut() {
  console.log(`[Tab ${tabId}] Signing out user`);
  await supabase.auth.signOut();
  user.set(null);
  console.log(`[Tab ${tabId}] User signed out`);
}

/**
 * Gets user data directly from the database
 * This can be used when the store might not be updated yet
 */
export async function getUserData(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error(`[Tab ${tabId}] Error fetching user data:`, error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`[Tab ${tabId}] Exception in getUserData:`, error);
    return null;
  }
}