# TASK-005: Loading States

## Overview
Implement contextual loading messages that rotate during enhancement processing.

## Priority
P0 — Week 1, Day 4-5

## Dependencies
- TASK-001 (Meeting capture UI)
- TASK-004 (Enhance display)

## Outputs
- `/js/loading-messages.js` — New file

## Acceptance Criteria

### Loading Messages
- [ ] Messages rotate every 3 seconds
- [ ] Messages are contextual (meeting vs note)
- [ ] Font: Cormorant Garamond, italic
- [ ] Color: gray-500 (#737373)
- [ ] Centered in container
- [ ] Subtle fade animation between messages

### Message Content
- [ ] Meeting messages feel appropriate for meeting context
- [ ] No generic "Loading..." or spinner
- [ ] Messages feel like Inscript brand voice

### Transitions
- [ ] Smooth fade between messages
- [ ] No layout shift during rotation
- [ ] Clean exit when content arrives

## Loading Messages

```javascript
// js/loading-messages.js

export const meetingLoadingMessages = [
  "weaving your thoughts together...",
  "finding the threads...",
  "structuring the conversation...",
  "connecting to your history...",
  "enhancing with context...",
  "organizing the chaos...",
  "turning fragments into form...",
  "reading between your lines...",
  "gathering what matters...",
  "building the picture...",
];

export const noteLoadingMessages = [
  "listening to your thoughts...",
  "finding the meaning...",
  "connecting the dots...",
  "reflecting on your words...",
  "understanding the context...",
  "weaving your narrative...",
  "discovering patterns...",
  "building understanding...",
];

export class LoadingMessages {
  constructor(container, type = 'meeting') {
    this.container = container;
    this.messages = type === 'meeting' ? meetingLoadingMessages : noteLoadingMessages;
    this.currentIndex = 0;
    this.interval = null;
  }

  start() {
    this.render();
    this.interval = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.messages.length;
      this.render();
    }, 3000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.container.innerHTML = '';
  }

  render() {
    const message = this.messages[this.currentIndex];
    this.container.innerHTML = `
      <div class="loading-container">
        <p class="loading-message">${message}</p>
      </div>
    `;
  }
}
```

## CSS Specs

```css
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  padding: 32px;
}

.loading-message {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 15px;
  font-style: italic;
  color: #737373;
  text-align: center;
  animation: fadeInOut 3s ease-in-out infinite;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

## Integration

```javascript
// In meeting-capture.js

import { LoadingMessages } from './loading-messages.js';

async enhance() {
  // Show loading
  const loader = new LoadingMessages(this.outputContainer, 'meeting');
  loader.start();

  try {
    // Make API call and stream response
    const response = await fetch('/api/enhance-meeting', { ... });
    
    // Stop loading when first content arrives
    loader.stop();
    
    // Continue with streaming display...
  } catch (error) {
    loader.stop();
    // Show error state
  }
}
```

## Test Checklist

- [ ] Messages rotate every 3 seconds
- [ ] Font is Cormorant Garamond italic
- [ ] Color is gray-500
- [ ] Fade animation works smoothly
- [ ] Messages stop when content arrives
- [ ] No layout shift during rotation
- [ ] Different messages for meeting vs note
- [ ] Centered in container
