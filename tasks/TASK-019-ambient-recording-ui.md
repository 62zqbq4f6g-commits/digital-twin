# TASK-019: Ambient Recording UI

## Overview
Create the UI for ambient listening — a full-screen recording interface for capturing meetings.

## Priority
P0 — Week 2, Day 1-2

## Dependencies
- TASK-006 (Voice input foundation)
- Design system

## Outputs
- `/js/ambient-recorder.js` — New file
- CSS additions to `/css/enhancement.css`
- Modal HTML in `index.html`

## Acceptance Criteria

### Entry Points
- [ ] "Start Listening" button on home screen
- [ ] Quick action in meeting capture modal
- [ ] Keyboard shortcut (Cmd/Ctrl + Shift + L)

### Mode Selection
- [ ] "Room" mode — uses device microphone
- [ ] "Video Call" mode — captures browser tab audio

### Recording Screen
- [ ] Full-screen modal (like meeting capture)
- [ ] Large recording indicator (red dot + "LISTENING")
- [ ] Duration timer (MM:SS)
- [ ] Inline notes textarea (optional user input)
- [ ] "End & Enhance" button

### Visual Design (from Design System)
- [ ] White background (#FFFFFF)
- [ ] Red recording dot (#E53935 or similar muted red)
- [ ] Duration in JetBrains Mono
- [ ] Inter for labels
- [ ] Cormorant Garamond italic for status messages
- [ ] Black "End & Enhance" button

## Component Structure

```javascript
// js/ambient-recorder.js

export class AmbientRecorder {
  constructor(container, options = {}) {
    this.container = container;
    this.userId = options.userId;
    this.onComplete = options.onComplete || (() => {});
    
    this.state = 'idle'; // idle | selecting | recording | processing
    this.mode = null; // 'room' | 'tab_audio'
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.userNotes = '';
    
    this.render();
    this.attachListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="ambient-recorder">
        <!-- Mode Selection (initial state) -->
        <div class="ambient-mode-select" data-state="selecting">
          <h2 class="ambient-title">Start Listening</h2>
          <p class="ambient-subtitle editorial-serif">Choose how to capture audio</p>
          
          <div class="ambient-modes">
            <button class="ambient-mode-btn" data-mode="room">
              <span class="mode-icon">🎙️</span>
              <span class="mode-label">Room</span>
              <span class="mode-desc">Use device microphone</span>
            </button>
            
            <button class="ambient-mode-btn" data-mode="tab_audio">
              <span class="mode-icon">🖥️</span>
              <span class="mode-label">Video Call</span>
              <span class="mode-desc">Capture browser tab audio</span>
            </button>
          </div>
          
          <button class="ambient-cancel">Cancel</button>
        </div>

        <!-- Recording State -->
        <div class="ambient-recording" data-state="recording" style="display: none;">
          <div class="ambient-indicator">
            <span class="recording-dot"></span>
            <span class="recording-label">LISTENING</span>
          </div>
          
          <div class="ambient-timer">00:00</div>
          
          <div class="ambient-notes-container">
            <label class="ambient-notes-label">Add notes while listening (optional)</label>
            <textarea 
              class="ambient-notes-input" 
              placeholder="Key points, action items, observations..."
            ></textarea>
          </div>
          
          <button class="ambient-end-btn">End & Enhance</button>
        </div>

        <!-- Processing State -->
        <div class="ambient-processing" data-state="processing" style="display: none;">
          <div class="ambient-processing-content">
            <div class="processing-spinner"></div>
            <p class="processing-message editorial-serif">transcribing your conversation...</p>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners() {
    // Mode selection
    this.container.querySelectorAll('.ambient-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectMode(btn.dataset.mode));
    });

    // Cancel
    this.container.querySelector('.ambient-cancel')
      .addEventListener('click', () => this.close());

    // End recording
    this.container.querySelector('.ambient-end-btn')
      .addEventListener('click', () => this.stopRecording());

    // Notes input
    this.container.querySelector('.ambient-notes-input')
      .addEventListener('input', (e) => this.userNotes = e.target.value);
  }

  async selectMode(mode) {
    this.mode = mode;
    
    try {
      if (mode === 'room') {
        await this.startRoomRecording();
      } else if (mode === 'tab_audio') {
        await this.startTabRecording();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError(error.message);
    }
  }

  async startRoomRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.startRecordingWithStream(stream);
  }

  async startTabRecording() {
    // Request tab audio via getDisplayMedia
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required by API
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    });
    
    // We only need audio, but video track is required for the API
    // Stop video track immediately to save resources
    stream.getVideoTracks().forEach(track => track.stop());
    
    this.startRecordingWithStream(stream);
  }

  startRecordingWithStream(stream) {
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    this.audioChunks = [];
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      this.processRecording(blob);
    };
    
    // Start recording with 30s chunks for long recordings
    this.mediaRecorder.start(30000);
    this.startTime = Date.now();
    this.startTimer();
    this.showRecordingState();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      this.container.querySelector('.ambient-timer').textContent = `${mins}:${secs}`;
    }, 1000);
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      clearInterval(this.timerInterval);
      this.showProcessingState();
    }
  }

  async processRecording(audioBlob) {
    // Hand off to processing pipeline (TASK-022)
    const duration = Math.floor((Date.now() - this.startTime) / 1000);
    
    this.onComplete({
      audioBlob,
      duration,
      mode: this.mode,
      userNotes: this.userNotes,
    });
  }

  showRecordingState() {
    this.container.querySelector('[data-state="selecting"]').style.display = 'none';
    this.container.querySelector('[data-state="recording"]').style.display = 'flex';
  }

  showProcessingState() {
    this.container.querySelector('[data-state="recording"]').style.display = 'none';
    this.container.querySelector('[data-state="processing"]').style.display = 'flex';
  }

  showError(message) {
    // Show error toast
    console.error(message);
  }

  close() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    clearInterval(this.timerInterval);
    // Close modal
  }
}
```

## CSS

```css
/* Ambient Recorder Styles */
.ambient-recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 48px 24px;
}

.ambient-title {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 8px;
}

.ambient-subtitle {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 16px;
  color: #6B6B6B;
  margin-bottom: 48px;
}

.ambient-modes {
  display: flex;
  gap: 24px;
  margin-bottom: 48px;
}

.ambient-mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 48px;
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 200ms ease-out;
}

.ambient-mode-btn:hover {
  border-color: #000000;
}

.mode-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.mode-label {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #1A1A1A;
  margin-bottom: 4px;
}

.mode-desc {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  color: #6B6B6B;
}

.ambient-cancel {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #6B6B6B;
  background: none;
  border: none;
  cursor: pointer;
}

/* Recording State */
.ambient-recording {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 500px;
}

.ambient-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.recording-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #E53935;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

.recording-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #1A1A1A;
}

.ambient-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  color: #1A1A1A;
  margin-bottom: 48px;
}

.ambient-notes-container {
  width: 100%;
  margin-bottom: 48px;
}

.ambient-notes-label {
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6B6B6B;
  margin-bottom: 12px;
}

.ambient-notes-input {
  width: 100%;
  min-height: 120px;
  padding: 16px;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #1A1A1A;
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  resize: vertical;
  transition: border-color 200ms ease-out;
}

.ambient-notes-input:focus {
  outline: none;
  border-color: #000000;
}

.ambient-end-btn {
  padding: 16px 48px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #FFFFFF;
  background: #000000;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 200ms ease-out;
}

.ambient-end-btn:hover {
  background: #1A1A1A;
}

/* Processing State */
.ambient-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.processing-message {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 18px;
  color: #6B6B6B;
  margin-top: 24px;
}

/* Mobile */
@media (max-width: 640px) {
  .ambient-modes {
    flex-direction: column;
    width: 100%;
  }
  
  .ambient-mode-btn {
    padding: 24px;
  }
  
  .ambient-timer {
    font-size: 36px;
  }
}
```

## Test Checklist

- [ ] Mode selection appears on open
- [ ] Room mode requests microphone permission
- [ ] Video Call mode triggers getDisplayMedia
- [ ] Recording indicator pulses
- [ ] Timer counts up correctly
- [ ] User can type notes during recording
- [ ] End button stops recording and triggers processing
- [ ] Cancel closes modal
- [ ] Works on mobile (Room mode only)
