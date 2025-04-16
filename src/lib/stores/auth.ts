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

// Generate a unique tab ID for logging
const tabId = Math.random().toString(36).substring(2, 15);

/**
 * Initialize the authentication state
 * Fetches the current session and updates the user store
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
    
    // Set up auth state change listener with minimal operations
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Tab ${tabId}] Auth state change event:`, event);
      
      // Only update the store based on events, without database operations
      if (event === 'SIGNED_IN' && session) {
        console.log(`[Tab ${tabId}] SIGNED_IN event received, user ID:`, session.user.id);
        // Get user info from database but don't wait for it
        getUserData(session.user.id)
          .then(userData => {
            if (userData) {
              // Update the store with existing user data
              user.set({
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role,
                user_metadata: session.user.user_metadata
              });
            }
          })
          .catch(err => {
            console.error(`[Tab ${tabId}] Error getting user data during auth change:`, err);
          });
      } else if (event === 'SIGNED_OUT') {
        console.log(`[Tab ${tabId}] SIGNED_OUT event received`);
        user.set(null);      
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Just log token refreshes, no database operations
        console.log(`[Tab ${tabId}] TOKEN_REFRESHED event received`);
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
 * Now simplified to only handle existing users
 */
async function initializeAuth() {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    console.log(`[Tab ${tabId}] Session found during init, user ID:`, session.user.id);
    // Get user data from database
    const userData = await getUserData(session.user.id);
    
    if (userData) {
      // Update the store with database info
      user.set({
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        user_metadata: session.user.user_metadata
      });
    } else {
      console.warn(`[Tab ${tabId}] User found in auth but not in database:`, session.user.id);
      user.set(null);
    }
  } else {
    console.log(`[Tab ${tabId}] No session found during init`);
    user.set(null);
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
    
    // Update last login in a non-blocking way after successful sign-in
    if (data.user) {
      updateLastLogin(data.user.id).catch(err => {
        console.error(`[Tab ${tabId}] Failed to update last login:`, err);
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error(`[Tab ${tabId}] Exception during sign in:`, error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Update the last_login timestamp for a user
 * Separate function to handle this specific task
 */
async function updateLastLogin(userId: string) {
  try {
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
    
    console.log(`[Tab ${tabId}] Last login updated for user:`, userId);
  } catch (error) {
    console.error(`[Tab ${tabId}] Error updating last login:`, error);
    throw error;
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
export async function ensureAuthenticated(): Promise<boolean> {
  // If auth is not initialized, initialize it
  if (!isInitialized) {
    console.log("[Auth] Ensuring auth is initialized");
    await initAuth(true);
  }
  
  // Check if user is in store
  let currentUser: UserData | null = null;
  const unsubscribe = user.subscribe(u => {
    currentUser = u;
  });
  unsubscribe();
  
  if (currentUser) {
    console.log("[Auth] User found in store");
    return true;
  }
  
  // No user in store, check session directly
  console.log("[Auth] No user in store, checking session directly");
  const { data } = await supabase.auth.getSession();
  
  if (data.session) {
    console.log("[Auth] Session found, re-syncing user");
    return true;
  }
  
  console.log("[Auth] No session found, user is not authenticated");
  return false;
}
