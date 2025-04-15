import { forceConnectionCheck } from '$lib/service/api-keep-alive';
import { browser } from '$app/environment';

export const load = async ({ params, fetch, depends }) => {
  // Force connection check when loading this page
  if (browser) {
    const isConnected = await forceConnectionCheck();
    if (!isConnected) {
      console.warn("Connection appears to be down on courses page load");
    }
  }
  
  // Signal dependencies - useful for triggering reloads
  depends('app:courses');
  
  return {
    // Any data for the page
  };
};