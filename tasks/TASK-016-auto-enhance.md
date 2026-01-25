# TASK-016: Auto-Enhance on Save

## Overview
Automatically trigger note enhancement when user saves a personal note.

## Priority
P0 — Week 1, Day 2-3

## Dependencies
- TASK-015 (Personal note enhancement API)
- Existing note save flow

## Outputs
- Modifications to note save logic
- Enhancement status indicator in UI

## Acceptance Criteria

### Behavior
- [ ] When user saves a note (type: note/idea/reflection), enhancement auto-triggers
- [ ] Enhancement runs in background (non-blocking)
- [ ] User sees subtle "enhancing..." indicator
- [ ] When complete, note updates with enhanced content
- [ ] If enhancement fails, original note preserved

### UI States
- [ ] SAVED: "Note saved" toast
- [ ] ENHANCING: Subtle shimmer on note card
- [ ] ENHANCED: "✨ enhanced" badge (fades after 3s)
- [ ] FAILED: Silent fail, no disruption

### Exclusions
- [ ] Meeting notes (already enhanced via meeting flow)
- [ ] Very short notes (< 20 characters)
- [ ] Notes already enhanced

## Implementation

```javascript
// In note save handler (e.g., js/ui.js or wherever notes are saved)

async function saveNote(noteData) {
  // Save note first
  const savedNote = await DB.saveNote(noteData);
  
  // Check if should auto-enhance
  if (shouldAutoEnhance(savedNote)) {
    triggerAutoEnhance(savedNote);
  }
  
  return savedNote;
}

function shouldAutoEnhance(note) {
  // Don't enhance meetings (handled separately)
  if (note.input?.type === 'meeting') return false;
  
  // Don't enhance very short notes
  const content = note.input?.text || note.content || '';
  if (content.length < 20) return false;
  
  // Don't re-enhance
  if (note.auto_enhanced) return false;
  
  return true;
}

async function triggerAutoEnhance(note) {
  // Show enhancing state
  showEnhancingIndicator(note.id);
  
  try {
    const response = await fetch('/api/enhance-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noteId: note.id,
        content: note.input?.text || note.content,
        noteType: note.input?.type || 'note',
        userId: getCurrentUserId(),
      }),
    });

    if (!response.ok) {
      throw new Error('Enhancement failed');
    }

    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let enhancedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'content') {
            enhancedContent += data.text;
          } else if (data.type === 'done') {
            // Update local note with enhancement
            await updateLocalNote(note.id, enhancedContent);
            showEnhancedIndicator(note.id);
          }
        }
      }
    }

  } catch (error) {
    console.error('Auto-enhance failed:', error);
    hideEnhancingIndicator(note.id);
    // Silent fail - don't disrupt user
  }
}

function showEnhancingIndicator(noteId) {
  const card = document.querySelector(`[data-note-id="${noteId}"]`);
  if (card) {
    card.classList.add('enhancing');
  }
}

function showEnhancedIndicator(noteId) {
  const card = document.querySelector(`[data-note-id="${noteId}"]`);
  if (card) {
    card.classList.remove('enhancing');
    card.classList.add('just-enhanced');
    
    // Fade out after 3s
    setTimeout(() => {
      card.classList.remove('just-enhanced');
    }, 3000);
  }
}
```

## CSS

```css
/* Enhancing state - subtle shimmer on card */
.note-card.enhancing {
  position: relative;
  overflow: hidden;
}

.note-card.enhancing::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #E5E5E5, transparent);
  animation: enhance-shimmer 1.5s infinite;
}

@keyframes enhance-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Just enhanced - subtle badge */
.note-card.just-enhanced::before {
  content: '✨ enhanced';
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6B6B6B;
  animation: fade-out 3s forwards;
}

@keyframes fade-out {
  0%, 70% { opacity: 1; }
  100% { opacity: 0; }
}
```

## Test Checklist

- [ ] Saving a note triggers auto-enhance
- [ ] Meeting notes excluded
- [ ] Short notes excluded
- [ ] Enhancing indicator visible during processing
- [ ] Enhanced badge shows on completion
- [ ] Failed enhancement doesn't disrupt user
- [ ] Original note preserved on failure
