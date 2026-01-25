# TASK-001: Meeting Capture UI Component

## Overview
Create the meeting capture UI component that allows users to input messy meeting notes.

## Priority
P0 — Week 1, Day 1-2

## Dependencies
- None (can start immediately)

## Inputs
- Design spec from INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section 8.1

## Outputs
- `/js/meeting-capture.js` — New file
- Modifications to `/js/ui.js` — Entry point integration

## Acceptance Criteria

### UI Elements
- [ ] Large text area (min-height: 200px)
- [ ] Optional title field (no label, placeholder only: "meeting title (optional)")
- [ ] Optional attendees field (placeholder: "who was there?")
- [ ] Main textarea (placeholder: "what happened? type freely or use voice..." italic)
- [ ] Voice button placeholder (44x44px, bottom-right of textarea)
- [ ] Enhance button (full width, black bg, white text, "ENHANCE NOTES")

### State Machine
- [ ] EMPTY state: placeholders visible, enhance button disabled (gray)
- [ ] CAPTURING state: content exists, enhance button enabled (black)
- [ ] ENHANCING state: input readonly, loading message shown
- [ ] ENHANCED state: show enhanced output (placeholder for now)

### Styling (STRICT)
- [ ] Black, white, silver only
- [ ] No shadows
- [ ] Border: 1px solid #E5E5E5
- [ ] Border radius: 2px max
- [ ] Enhance button: black bg, 0 border-radius

### Functionality
- [ ] Title field optional
- [ ] Attendees field optional  
- [ ] Can submit with just main textarea content
- [ ] Enhance button calls API (stub for now)

## CSS Specs

```css
.meeting-capture {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px;
}

.meeting-title-input {
  width: 100%;
  font-size: 18px;
  font-weight: 500;
  border: none;
  border-bottom: 1px solid transparent;
  padding: 0 0 8px 0;
  background: transparent;
}

.meeting-title-input:focus {
  outline: none;
  border-bottom-color: #000;
}

.meeting-title-input::placeholder {
  color: #A3A3A3;
  font-weight: 400;
}

.meeting-content-area {
  position: relative;
  width: 100%;
  min-height: 200px;
  border: 1px solid #E5E5E5;
  border-radius: 2px;
}

.meeting-content-area:focus-within {
  border-color: #000;
}

.meeting-content-textarea {
  width: 100%;
  min-height: 200px;
  padding: 16px;
  padding-right: 60px;
  font-size: 15px;
  line-height: 1.6;
  border: none;
  resize: vertical;
}

.meeting-content-textarea::placeholder {
  color: #A3A3A3;
  font-style: italic;
}

.voice-button {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid #E5E5E5;
  background: #FFF;
  cursor: pointer;
}

.enhance-button {
  width: 100%;
  padding: 16px 24px;
  margin-top: 24px;
  background: #000;
  color: #FFF;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: none;
  border-radius: 0;
  cursor: pointer;
}

.enhance-button:disabled {
  background: #E5E5E5;
  color: #A3A3A3;
  cursor: not-allowed;
}
```

## Component Structure

```javascript
// js/meeting-capture.js

export class MeetingCapture {
  constructor(container) {
    this.container = container;
    this.state = 'empty'; // empty | capturing | enhancing | enhanced
    this.render();
    this.attachListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="meeting-capture">
        <input 
          type="text" 
          class="meeting-title-input" 
          placeholder="meeting title (optional)"
        />
        
        <input 
          type="text" 
          class="meeting-attendees-input" 
          placeholder="who was there?"
          style="margin-top: 24px;"
        />
        
        <div class="meeting-content-area" style="margin-top: 24px;">
          <textarea 
            class="meeting-content-textarea"
            placeholder="what happened? type freely or use voice..."
          ></textarea>
          <button class="voice-button" title="Voice input">
            🎤
          </button>
        </div>
        
        <button class="enhance-button" disabled>
          ENHANCE NOTES
        </button>
      </div>
    `;
  }

  attachListeners() {
    const textarea = this.container.querySelector('.meeting-content-textarea');
    const enhanceBtn = this.container.querySelector('.enhance-button');
    
    textarea.addEventListener('input', () => {
      this.setState(textarea.value.trim() ? 'capturing' : 'empty');
    });
    
    enhanceBtn.addEventListener('click', () => this.enhance());
  }

  setState(newState) {
    this.state = newState;
    const enhanceBtn = this.container.querySelector('.enhance-button');
    enhanceBtn.disabled = newState === 'empty';
  }

  async enhance() {
    // TODO: Implement in TASK-004
    this.setState('enhancing');
    console.log('Enhance clicked - API call goes here');
  }

  getData() {
    return {
      title: this.container.querySelector('.meeting-title-input').value,
      attendees: this.container.querySelector('.meeting-attendees-input').value,
      content: this.container.querySelector('.meeting-content-textarea').value,
    };
  }
}
```

## Integration with ui.js

Add entry point in ui.js to render MeetingCapture when user selects meeting mode:

```javascript
import { MeetingCapture } from './meeting-capture.js';

// In the appropriate place where note types are handled
function showMeetingCapture() {
  const container = document.getElementById('note-container'); // or appropriate container
  new MeetingCapture(container);
}
```

## Test Checklist

- [ ] Renders without errors
- [ ] Placeholder text correct
- [ ] Enhance button disabled when empty
- [ ] Enhance button enabled when content exists
- [ ] Focus states work (border turns black)
- [ ] Styling matches spec exactly
- [ ] Mobile responsive (test at 375px)

## Notes

- Voice button is placeholder only — actual functionality in TASK-006
- Enhance API call is stub — actual implementation in TASK-002
- Enhanced output display is placeholder — actual implementation in TASK-004
