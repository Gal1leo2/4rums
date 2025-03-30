// src/lib/stores/auth.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import { browser } from '$app/environment';

// Create the user store
export const user = writable(null);

// Initialize auth and set up listeners
export async function initAuth() {
  console.log("Initializing auth");
  
  if (!browser) return; // Skip on server
  
  // Get current session
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("Auth session error:", error);
    return;
  }
  
  // Set user if session exists
  if (data.session) {
    console.log("Found existing session:", data.session);
    user.set(data.session.user);
  } else {
    console.log("No active session found");
  }
  
  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event);
    user.set(session?.user || null);
  });
  
  return () => {
    subscription.unsubscribe();
  };
}