<!-- src/routes/about/+page.svelte -->
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
  </script>
  
  <div class="container mx-auto py-8 px-4 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">About 4rum</h1>
    
    <Card class="mb-8">
      <CardHeader class="pb-3">
        <CardTitle>Our Mission</CardTitle>
        <CardDescription>Creating a safe space for academic discussions</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="mb-4">
          4rum is an anonymous Q&A platform designed specifically for educational environments. Our mission is to foster open communication between students and instructors by removing barriers that might otherwise prevent students from seeking help or expressing their thoughts.
        </p>
        <p>
          By offering anonymity as an option, we aim to create a space where students can ask questions without fear of judgment, while still maintaining a structured, respectful, and moderated environment that promotes learning.
        </p>
      </CardContent>
    </Card>
    
    <Card class="mb-8">
      <CardHeader class="pb-3">
        <CardTitle class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="M8 12h8"></path>
            <path d="M12 8v8"></path>
          </svg>
          Features
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="space-y-2">
          <li class="flex items-start gap-2">
            <Badge variant="outline" class="mt-0.5 bg-blue-50 text-blue-700 border-blue-200">Anonymous Posting</Badge>
            <span>Ask questions without revealing your identity</span>
          </li>
          <li class="flex items-start gap-2">
            <Badge variant="outline" class="mt-0.5 bg-green-50 text-green-700 border-green-200">Instructor Endorsements</Badge>
            <span>Verified answers from course instructors</span>
          </li>
          <li class="flex items-start gap-2">
            <Badge variant="outline" class="mt-0.5 bg-amber-50 text-amber-700 border-amber-200">Organization Tools</Badge>
            <span>Course folders and tags for easy navigation</span>
          </li>
          <li class="flex items-start gap-2">
            <Badge variant="outline" class="mt-0.5 bg-purple-50 text-purple-700 border-purple-200">Markdown Support</Badge>
            <span>Rich formatting for code snippets and equations</span>
          </li>
        </ul>
      </CardContent>
    </Card>
    
    <Card class="mb-8">
      <CardHeader class="pb-3">
        <CardTitle>How It Works</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-6">
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex items-center justify-center md:flex-none">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                <span class="text-xl font-bold">1</span>
              </div>
            </div>
            <div>
              <h3 class="text-lg font-medium mb-1">Access Your Courses</h3>
              <p class="text-muted-foreground">As a KDAI student or faculty member, your courses are automatically available to you when you sign in with your institutional credentials.</p>
            </div>
          </div>
          
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex items-center justify-center md:flex-none">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <span class="text-xl font-bold">2</span>
              </div>
            </div>
            <div>
              <h3 class="text-lg font-medium mb-1">Ask Questions & Participate</h3>
              <p class="text-muted-foreground">Post your questions anonymously or with your name. Instructors and fellow students can provide answers, with the best responses getting endorsed.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Our Story</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="mb-4">
          4rum was developed as a project for Foundation Programming class at KDAI, KMITL. Inspired by platforms like Piazza and Ed Discussion, we wanted to create a solution specifically tailored to the needs of our program.
        </p>
        <p class="mb-4">
          Our team recognized that many students hesitate to ask questions in traditional classroom settings due to concerns about being judged. We believed that technology could help bridge this gap by providing a platform where students could engage with course material without these barriers.
        </p>
        <p>
          Today, 4rum is an evolving platform that continues to grow based on feedback from instructors and students.
        </p>
      </CardContent>
    </Card>
  </div>