<!-- src/routes/+page.svelte -->
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { user } from "$lib/stores/auth";
  </script>
  
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-3xl mx-auto text-center">
      <h1 class="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
        Welcome to Anonymous Q&A
      </h1>
      
      <p class="text-lg text-muted-foreground mb-8">
        A platform for students and instructors to ask and answer questions anonymously
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        {#if $user}
          <Button href="/courses">View Your Courses</Button>
        {:else}
          <Button href="/auth/login">Sign In</Button>
          <Button href="/auth/register" variant="outline">Register</Button>
        {/if}
      </div>
    </div>
    
    <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <div class="flex flex-col items-center text-center p-4">
        <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M9.9 19.7 3.7 13.5c-1-1-1-2.6 0-3.5l6.2-6.2c1-1 2.6-1 3.5 0l6.2 6.2c1 1 1 2.6 0 3.5l-6.2 6.2c-1 1-2.5 1-3.5 0Z"/><path d="M9.9 5.9 14.1 10"/><path d="M9.9 18.1 14.1 14"/></svg>
        </div>
        <h2 class="text-xl font-semibold mb-2">Ask Anonymously</h2>
        <p class="text-muted-foreground">
          Feel free to ask questions without revealing your identity
        </p>
      </div>
      
      <div class="flex flex-col items-center text-center p-4">
        <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <h2 class="text-xl font-semibold mb-2">Get Quick Answers</h2>
        <p class="text-muted-foreground">
          Connect with instructors and peers to solve problems
        </p>
      </div>
      
      <div class="flex flex-col items-center text-center p-4">
        <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
        </div>
        <h2 class="text-xl font-semibold mb-2">Verified Answers</h2>
        <p class="text-muted-foreground">
          Identify instructor-endorsed solutions quickly
        </p>
      </div>
    </div>
  </div>