<script lang="ts">
    import { onMount } from 'svelte';
  
    export let userName: string = '';
  
    const regionalGreetings = [
      { greeting: 'Bonjour', region: 'French' },
      { greeting: 'Hola', region: 'Spanish' },
      { greeting: 'Ciao', region: 'Italian' },
      { greeting: 'Hallo', region: 'German' },
      { greeting: 'Olá', region: 'Portuguese' },
      { greeting: 'Namaste', region: 'Hindi', script: 'नमस्ते' },
      { greeting: 'Konnichiwa', region: 'Japanese', script: 'こんにちは' },
      { greeting: 'Annyeong', region: 'Korean', script: '안녕' },
      { greeting: 'สวัสดี', region: 'Thai' },
      { greeting: 'Merhaba', region: 'Turkish' },
      { greeting: 'Zdravstvuyte', region: 'Russian', script: 'Здравствуйте' },
      { greeting: 'Nǐ hǎo', region: 'Chinese (Mandarin)', script: '你好' },
      { greeting: 'Shalom', region: 'Hebrew', script: 'שלום' },
      { greeting: 'Salaam', region: 'Arabic', script: 'سلام' },
      { greeting: 'Sawubona', region: 'Zulu' },
      { greeting: 'Hej', region: 'Swedish' },
      { greeting: 'Jambo', region: 'Swahili' },
      { greeting: 'Aloha', region: 'Hawaiian' },
      { greeting: 'Hallo', region: 'Dutch' },
      { greeting: 'Dzień dobry', region: 'Polish' },
      { greeting: 'Kamusta', region: 'Filipino' },
      { greeting: 'Sawasdee', region: 'Lao', script: 'ສະບາຍດີ' },
      { greeting: 'Selam', region: 'Amharic', script: 'ሰላም' },
      { greeting: 'Habari', region: 'Swahili' },
      { greeting: 'Yassas', region: 'Greek', script: 'Γειά σας' }
    ];
  
    let selectedGreeting = regionalGreetings[0];
    let isThaiGreeting = false;
  
    onMount(() => {
      const randomIndex = Math.floor(Math.random() * regionalGreetings.length);
      selectedGreeting = regionalGreetings[randomIndex];
      isThaiGreeting = selectedGreeting.greeting === 'สวัสดี';
    });
  </script>
  
  <div class="greeting-container">
    <span class="greeting {isThaiGreeting ? 'flare' : ''}">{selectedGreeting.greeting}!</span>
    {#if userName}
      <span class="user-name">{userName}</span>
    {/if}
    <span class="tooltip">{selectedGreeting.region}</span>
  </div>
  
  <style>
    .greeting-container {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
    }
  
    .greeting {
      font-weight: 600;
      position: relative;
    }
  
    .greeting:hover + .tooltip {
      visibility: visible;
      opacity: 1;
    }
  
    .user-name {
      font-weight: 500;
    }
  
    .tooltip {
      position: absolute;
      top: -24px;
      left: 0;
      background-color: #333;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      visibility: hidden;
      opacity: 0;
      transition: all 0.2s ease;
      pointer-events: none;
      white-space: nowrap;
    }
  
    .flare {
      animation: flareEffect 2s ease-out;
      color: gold;
    }
  
    @keyframes flareEffect {
      0%, 100% {
        transform: translateY(0);
        color: inherit;
      }
      50% {
        transform: translateY(-10px);
        color: coral;
      }
    }
  </style>