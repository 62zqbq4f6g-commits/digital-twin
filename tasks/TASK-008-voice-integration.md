# TASK-008: Voice → Enhance Integration

## Overview
Connect voice recording to transcription API and meeting capture flow.

## Priority
P0 — Week 2, Day 2-3

## Dependencies
- TASK-001 (Meeting capture UI)
- TASK-006 (Voice recording)
- TASK-007 (Transcription API)

## Outputs
- Modifications to `/js/meeting-capture.js`

## Acceptance Criteria

### Flow
- [ ] User clicks mic → records → stops → transcribes → text appears in textarea
- [ ] Transcribed text is editable before enhancement
- [ ] Multiple recordings append (don't replace existing text)
- [ ] User can enhance after voice input

### States
- [ ] Recording indicator visible during recording
- [ ] "Transcribing..." shown while API processes
- [ ] Text appears in textarea when complete
- [ ] Error message if transcription fails

### UX
- [ ] Textarea scrolls to show new text
- [ ] Cursor placed at end of text
- [ ] No data loss on error

## Integration Code

```javascript
// In meeting-capture.js

import { VoiceInput } from './voice-input.js';

// In constructor or init
this.voiceInput = new VoiceInput(this.voiceButton, {
  onRecordingComplete: (blob) => this.handleRecording(blob),
  onError: (error) => this.handleVoiceError(error),
});

async handleRecording(blob) {
  const formData = new FormData();
  formData.append('audio', blob);
  formData.append('userId', this.userId);

  try {
    const response = await fetch('/api/transcribe-voice', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      // Append to textarea
      const textarea = this.container.querySelector('.meeting-content-textarea');
      const existing = textarea.value;
      const separator = existing && !existing.endsWith(' ') ? ' ' : '';
      textarea.value = existing + separator + data.text;
      
      // Trigger input event to update state
      textarea.dispatchEvent(new Event('input'));
      
      // Focus and scroll to end
      textarea.focus();
      textarea.scrollTop = textarea.scrollHeight;
    } else {
      this.handleVoiceError(new Error(data.error.message));
    }
  } catch (error) {
    this.handleVoiceError(error);
  } finally {
    this.voiceInput.setIdle();
  }
}

handleVoiceError(error) {
  console.error('Voice error:', error);
  // Show error toast or message
  // Don't lose any existing textarea content
}
```

## Test Checklist

- [ ] Voice → transcription → textarea flow works
- [ ] Multiple recordings append correctly
- [ ] Existing text preserved
- [ ] Can enhance after voice input
- [ ] Error doesn't clear textarea
- [ ] Works on desktop Chrome
- [ ] Works on mobile Safari
- [ ] Works on mobile Chrome
