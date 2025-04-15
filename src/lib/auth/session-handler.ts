// src/lib/auth/session-handler.ts
import { supabase } from '$lib/supabase/client';
import { user } from '$lib/stores/auth';
import { get } from 'svelte/store';

/**
 * Refreshes the user session if needed and ensures API calls will work
 * 
 * @returns A promise that resolves to true if session is valid
 */
export async function ensureValidSession(): Promise<boolean> {
    try {
      console.log("ensureValidSession called");
      // Check if we have a user in the store
      const currentUser = get(user);
      console.log("Current user from store:", !!currentUser);
      
      if (!currentUser) {
        console.warn('No user in store, redirecting to login');
        window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
        return false;
      }
      
      console.log("About to check session with supabase");
      // Get the current session
      const { data, error } = await supabase.auth.getSession();
      console.log("Session check result:", { hasSession: !!data?.session, hasError: !!error });
      
      // If no session or error, try refreshing
      if (error || !data.session) {
        console.log('Session expired or not found, attempting refresh...');
        
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        console.log("Refresh result:", { hasSession: !!refreshData?.session, hasError: !!refreshError });
        
        if (refreshError || !refreshData.session) {
          console.error('Failed to refresh session:', refreshError);
          
          // Clear user store and redirect to login
          user.set(null);
          window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
          return false;
        }
        
        console.log('Session refreshed successfully');
        return true;
      }
      
      // Session exists and is valid
      console.log("Session is valid, returning true");
      return true;
    } catch (err) {
      console.error('Error in ensureValidSession:', err);
      return false;
    }
  }

/**
 * Makes an API call with automatic session refresh on 401 errors
 * 
 * @param apiCall Function that makes the actual API call
 * @param maxRetries Maximum number of retries (default: 1)
 * @returns The result of the API call
 */
export async function withSessionRefresh<T>(
  apiCall: () => Promise<T>, 
  maxRetries = 1
): Promise<T> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      // Ensure session is valid before making the call
      const isValid = await ensureValidSession();
      
      if (!isValid) {
        throw new Error('Invalid session');
      }
      
      // Execute the API call
      return await apiCall();
    } catch (error: any) {
      // Check if this is an auth error (401)
      const isAuthError = 
        error?.status === 401 || 
        error?.statusCode === 401 || 
        error?.code === 'PGRST301' ||
        (typeof error?.message === 'string' && 
         error.message.includes('JWT expired'));
      
      // If it's an auth error and we haven't exceeded retries
      if (isAuthError && retries < maxRetries) {
        console.log(`Auth error detected, refreshing session (retry ${retries + 1}/${maxRetries})`);
        
        // Refresh and try again
        const refreshResult = await supabase.auth.refreshSession();
        
        if (refreshResult.error) {
          // If we can't refresh, redirect to login
          console.error('Failed to refresh during API call:', refreshResult.error);
          window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
          throw error;
        }
        
        // Increment retry counter and try again
        retries++;
      } else {
        // Not an auth error or exceeded retries
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}