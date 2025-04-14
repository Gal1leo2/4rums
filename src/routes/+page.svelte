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