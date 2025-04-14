<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { Button } from "$lib/components/ui/button";
  import { user } from "$lib/stores/auth";
  
  let showFeatures = false;
  
  onMount(() => {
    showFeatures = true;
  });
</script>

<div class="min-h-screen bg-white">
  <div class="container mx-auto px-4 py-12">
    <!-- Hero Section -->
    <div class="max-w-3xl mx-auto text-center pt-12 pb-16">
      <div class="mb-6">
        <span class="inline-block bg-primary/20 text-primary px-4 py-1 rounded-full text-sm font-medium mb-4">
          Beta Version
        </span>
      </div>
      
      <h1 class="text-5xl font-bold tracking-tight sm:text-6xl mb-6 bg-gradient-to-r from-primary to-purple-500 text-transparent bg-clip-text">
        Welcome to 4rum
      </h1>
      
      <p class="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
        The anonymous Q&A platform where students and instructors connect freely, without judgment or hesitation.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        {#if $user}
          <Button href="/courses" size="lg" class="shadow-md shadow-primary/10">View Your Courses</Button>
        {:else}
          <Button href="/auth/login" size="lg" class="shadow-md shadow-primary/10">Sign In</Button>
        {/if}
      </div>
    </div>
    
    <!-- Features Section -->
    {#if showFeatures}
      <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto" in:fade={{ duration: 800, delay: 200 }}>
        <div class="flex flex-col items-center text-center p-8 bg-gray-50 rounded-xl shadow-sm hover:shadow-md transition-shadow" in:fly={{ y: 20, duration: 600, delay: 300 }}>
          <div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M9.9 19.7 3.7 13.5c-1-1-1-2.6 0-3.5l6.2-6.2c1-1 2.6-1 3.5 0l6.2 6.2c1 1 1 2.6 0 3.5l-6.2 6.2c-1 1-2.5 1-3.5 0Z"/><path d="M9.9 5.9 14.1 10"/><path d="M9.9 18.1 14.1 14"/></svg>
          </div>
          <h2 class="text-2xl font-semibold mb-3">Ask Anonymously</h2>
          <p class="text-gray-600 mb-6">
            Feel free to ask questions without revealing your identity. No judgment, just knowledge sharing.
          </p>
        </div>
        
        <div class="flex flex-col items-center text-center p-8 bg-gray-50 rounded-xl shadow-sm hover:shadow-md transition-shadow" in:fly={{ y: 20, duration: 600, delay: 400 }}>
          <div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <h2 class="text-2xl font-semibold mb-3">Fast Responses</h2>
          <p class="text-gray-600 mb-6">
            Connect directly with instructors and peers to solve problems and clarify concepts quickly.
          </p>
        </div>
        
        <div class="flex flex-col items-center text-center p-8 bg-gray-50 rounded-xl shadow-sm hover:shadow-md transition-shadow" in:fly={{ y: 20, duration: 600, delay: 500 }}>
          <div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          </div>
          <h2 class="text-2xl font-semibold mb-3">Verified Answers</h2>
          <p class="text-gray-600 mb-6">
            Easily identify instructor-endorsed solutions with verification badges to ensure accurate information.
          </p>
        </div>
      </div>
    {/if}
    
    <!-- CTA Section -->

  </div>
  
  <!-- Footer -->
  <footer class="border-t border-gray-100 py-8 mt-12">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="mb-4 md:mb-0">
          <p class="font-semibold text-lg">4rum</p>
          <p class="text-sm text-gray-500">Anonymous Q&A</p>
          <p class="text-sm text-gray-500 mt-1">Now used in Foundation Programming class at KDAI, KMITL</p>
        </div>
        <div class="flex gap-6">
          <a href="/about" class="text-sm text-gray-500 hover:text-gray-900">About</a>
          <a href="/privacy" class="text-sm text-gray-500 hover:text-gray-900">Privacy</a>
          <a href="/contact" class="text-sm text-gray-500 hover:text-gray-900">Contact</a>
        </div>
      </div>
    </div>
  </footer>
</div>