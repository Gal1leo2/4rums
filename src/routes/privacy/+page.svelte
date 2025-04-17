<!-- src/routes/privacy/+page.svelte -->
<script lang="ts">
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
    import { Separator } from "$lib/components/ui/separator";
  </script>
  
  <div class="container mx-auto py-8 px-4 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p class="text-muted-foreground">Last updated: April 16, 2025</p>
    </div>
    
    <Card class="mb-8">
      <CardHeader class="pb-3">
        <CardTitle>Introduction</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="mb-4">
          At 4rum, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, process, and safeguard your information when you use our platform in accordance with Thailand's Personal Data Protection Act (PDPA) B.E. 2562 (2019).
        </p>
        <p>
          By using 4rum, you consent to the collection and use of your information as described in this policy. We encourage you to read this Privacy Policy carefully to understand our practices regarding your personal data.
        </p>
      </CardContent>
    </Card>
  
    <Accordion type="single" collapsible class="mb-8">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Data Controller Information</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            4rum (operated as a project for Foundation Programming class at KDAI, KMITL) is the data controller responsible for your personal data.
          </p>
          <p class="mb-2 font-medium">Contact Details:</p>
          <ul class="list-disc ml-6 mb-4">
            <li>Email: 66050977@kmitl.ac.th</li>
            <li>Address: King Mongkut's Institute of Technology Ladkrabang, Bangkok, Thailand</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-2">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Personal Data We Collect</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">We may collect, use, store, and transfer different kinds of personal data about you, which we have grouped as follows:</p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">Identity Data</h3>
              <p class="text-muted-foreground">Includes your name, username or similar identifier, and institutional role (student, instructor, teaching assistant).</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Contact Data</h3>
              <p class="text-muted-foreground">Includes your email address.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Technical Data</h3>
              <p class="text-muted-foreground">Includes internet protocol (IP) address, browser type and version, time zone setting, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access our platform.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Profile Data</h3>
              <p class="text-muted-foreground">Includes your username and password, posts, comments, responses, feedback, and course enrollments.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Usage Data</h3>
              <p class="text-muted-foreground">Includes information about how you use our platform, such as what pages you visit and features you use.</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-3">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold text-left">How We Collect Your Personal Data</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">We use different methods to collect data from and about you including through:</p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">Direct Interactions</h3>
              <p class="text-muted-foreground">You may provide us with your Identity and Contact Data by filling in forms or by corresponding with us. This includes personal data you provide when you create an account, post content on our platform, or contact us.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Automated Technologies or Interactions</h3>
              <p class="text-muted-foreground">As you interact with our platform, we may automatically collect Technical Data about your equipment, browsing actions, and patterns. We collect this personal data by using cookies, server logs, and other similar technologies.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Third Parties</h3>
              <p class="text-muted-foreground">We may receive personal data about you from various third parties, such as your educational institution or authentication providers (e.g., Google).</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="item-4">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">How We Use Your Personal Data</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">To Provide Services</h3>
              <p class="text-muted-foreground">To create and manage your account, to provide the platform's features and functionality, and to respond to your inquiries and requests.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">To Improve Services</h3>
              <p class="text-muted-foreground">To analyze usage patterns, identify trends, and enhance the user experience of our platform.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">To Manage User Relationships</h3>
              <p class="text-muted-foreground">To notify you about changes to our platform or policies, and to provide customer support.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">To Ensure Security</h3>
              <p class="text-muted-foreground">To protect our platform, users, and services from fraud, unauthorized access, and other security concerns.</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-5">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Legal Basis for Processing</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">Under the PDPA, we must have a legal basis for processing your personal data. We primarily rely on the following legal bases:</p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">Consent</h3>
              <p class="text-muted-foreground">Where you have given explicit consent for us to process your personal data for specific purposes.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Contractual Necessity</h3>
              <p class="text-muted-foreground">Where processing is necessary for the performance of a contract with you (such as our Terms of Service) or to take steps at your request before entering into such a contract.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Legitimate Interests</h3>
              <p class="text-muted-foreground">Where processing is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Legal Obligation</h3>
              <p class="text-muted-foreground">Where processing is necessary for compliance with a legal obligation to which we are subject.</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-6">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Data Storage and Security</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            We take appropriate security measures to prevent unauthorized access, disclosure, modification, or unauthorized destruction of your personal data. All personal data is stored securely in accordance with the principles of the PDPA.
          </p>
          <p class="mb-4">
            We use Supabase for our database management and authentication services, which provides encryption at rest and in transit for all data. Access to your personal data is limited to authorized personnel only, on a need-to-know basis.
          </p>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-7">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Data Retention</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.
          </p>
          <p class="mb-4">
            For users associated with educational courses, we typically retain your data for the duration of the course plus an additional academic year, after which it may be anonymized or deleted.
          </p>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-8">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Your Rights Under PDPA</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">Under the PDPA, you have various rights with respect to your personal data, including:</p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">Right to Access</h3>
              <p class="text-muted-foreground">You have the right to request access to your personal data and to receive a copy of the personal data we hold about you.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Rectification</h3>
              <p class="text-muted-foreground">You have the right to request correction of inaccurate personal data that we hold about you.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Erasure</h3>
              <p class="text-muted-foreground">You have the right to request erasure of your personal data in certain circumstances.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Restrict Processing</h3>
              <p class="text-muted-foreground">You have the right to request restriction of processing of your personal data in certain circumstances.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Data Portability</h3>
              <p class="text-muted-foreground">You have the right to request the transfer of your personal data to you or to a third party in a structured, commonly used, machine-readable format.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Object</h3>
              <p class="text-muted-foreground">You have the right to object to processing of your personal data where we are relying on a legitimate interest (or those of a third party).</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Right to Withdraw Consent</h3>
              <p class="text-muted-foreground">You have the right to withdraw consent at any time where we are relying on consent to process your personal data.</p>
            </div>
          </div>
          
          <p class="mt-4">
            If you wish to exercise any of these rights, please contact us at 66050977@kmitl.ac.th.
          </p>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-9">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Cookies and Similar Technologies</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            We use cookies and similar tracking technologies to track activity on our platform and to hold certain information. Cookies are files with small amounts of data which may include an anonymous unique identifier.
          </p>
          <p class="mb-4">
            We use the following types of cookies:
          </p>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-medium mb-1">Essential Cookies</h3>
              <p class="text-muted-foreground">Necessary for the operation of our platform. These include cookies that enable you to log into secure areas of our platform.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Functional Cookies</h3>
              <p class="text-muted-foreground">Enable us to personalize your experience by remembering your preferences.</p>
            </div>
            
            <div>
              <h3 class="font-medium mb-1">Analytical Cookies</h3>
              <p class="text-muted-foreground">Allow us to recognize and count the number of visitors and to see how visitors move around our platform when they are using it.</p>
            </div>
          </div>
          
          <p class="mt-4">
            You can set your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our platform.
          </p>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-10">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Anonymous Content</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            Our platform allows users to post content anonymously. While such content is not publicly associated with your identity, please note that:
          </p>
          <ul class="list-disc ml-6 mb-4">
            <li>For platform administration and security purposes, we maintain internal records linking anonymous content to user accounts.</li>
            <li>Your institution's administrators may have the ability to view this information in specific circumstances related to policy enforcement or legal requirements.</li>
            <li>Anonymous content is still subject to our Terms of Service and Content Guidelines.</li>
          </ul>
          <p>
            We encourage users to use the anonymity feature responsibly and in accordance with academic integrity standards.
          </p>
        </AccordionContent>
      </AccordionItem>
  
      <AccordionItem value="item-11">
        <AccordionTrigger>
          <h2 class="text-xl font-semibold">Changes to This Privacy Policy</h2>
        </AccordionTrigger>
        <AccordionContent>
          <p class="mb-4">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </p>
          <p class="mb-4">
            You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Contact Us</CardTitle>
        <CardDescription>If you have any questions about this Privacy Policy, please contact us:</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-col md:flex-row md:items-center gap-4">
          <div class="rounded-md border p-4 flex-1">
            <h3 class="font-medium mb-2">Email</h3>
            <p class="text-muted-foreground">66050977@kmitl.ac.th</p>
          </div>
          
          <div class="rounded-md border p-4 flex-1">
            <h3 class="font-medium mb-2">Address</h3>
            <p class="text-muted-foreground">King Mongkut's Institute of Technology Ladkrabang<br />Bangkok, Thailand</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>