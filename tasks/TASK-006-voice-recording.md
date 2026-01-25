# TASK-006: Voice Recording (Browser)

## Overview
Implement browser-based audio recording for voice input in meeting capture.

## Priority
P0 — Week 2, Day 1

## Dependencies
- TASK-001 (Meeting capture UI with voice button placeholder)

## Outputs
- `/js/voice-input.js` — New file

## Acceptance Criteria

### Recording
- [ ] Click mic button to start recording
- [ ] Click again to stop
- [ ] Max recording time: 2 minutes (auto-stop)
- [ ] Request microphone permission on first use

### UI States
- [ ] IDLE: Gray mic icon, 1px border
- [ ] RECORDING: Black background, white icon, pulse animation
- [ ] TRANSCRIBING: Loading indicator, "Transcribing..." label

### Visual Feedback
- [ ] Recording duration counter visible
- [ ] Pulse animation while recording
- [ ] Clear transition between states

### Output
- [ ] Returns audio blob for transcription API
- [ ] Supports WebM or WAV format

## Component Structure

```javascript
// js/voice-input.js

export class VoiceInput {
  constructor(button, options = {}) {
    this.button = button;
    this.onRecordingComplete = options.onRecordingComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.maxDuration = options.maxDuration || 120000; // 2 minutes
    
    this.state = 'idle'; // idle | recording | transcribing
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = null;
    this.timerInterval = null;
    
    this.attachListeners();
  }

  attachListeners() {
    this.button.addEventListener('click', () => this.toggle());
  }

  async toggle() {
    if (this.state === 'idle') {
      await this.startRecording();
    } else if (this.state === 'recording') {
      this.stopRecording();
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        this.onRecordingComplete(blob);
      };
      
      this.mediaRecorder.start();
      this.state = 'recording';
      this.startTime = Date.now();
      this.startTimer();
      this.updateUI();
      
      // Auto-stop at max duration
      setTimeout(() => {
        if (this.state === 'recording') this.stopRecording();
      }, this.maxDuration);
      
    } catch (error) {
      this.onError(error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.state === 'recording') {
      this.mediaRecorder.stop();
      this.stopTimer();
      this.state = 'transcribing';
      this.updateUI();
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimer() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    // Update duration display
  }

  updateUI() {
    this.button.classList.remove('idle', 'recording', 'transcribing');
    this.button.classList.add(this.state);
  }

  setIdle() {
    this.state = 'idle';
    this.updateUI();
  }
}
```

## CSS Specs

```css
.voice-button {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid #E5E5E5;
  background: #FFFFFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 200ms ease;
}

.voice-button:hover {
  border-color: #000000;
}

.voice-button.recording {
  background: #000000;
  border-color: #000000;
  animation: pulse 1.5s ease-in-out infinite;
}

.voice-button.recording svg {
  color: #FFFFFF;
}

.voice-button.transcribing {
  background: #FAFAFA;
  border-color: #E5E5E5;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.recording-duration {
  position: absolute;
  bottom: 60px;
  right: 12px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: #737373;
}
```

## Test Checklist

- [ ] Mic permission requested on first click
- [ ] Recording starts on click
- [ ] Recording stops on second click
- [ ] Auto-stops at 2 minutes
- [ ] Pulse animation visible while recording
- [ ] Duration counter updates
- [ ] Audio blob returned on complete
- [ ] Error handled if permission denied
- [ ] Works on mobile Safari
