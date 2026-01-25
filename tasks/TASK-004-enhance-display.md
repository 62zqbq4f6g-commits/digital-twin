# TASK-004: Enhanced Output Display

## Overview
Build the component that displays the enhanced meeting output with streaming support and Inscript Context section.

## Priority
P0 — Week 1, Day 3-4

## Dependencies
- TASK-001 (Meeting capture UI)
- TASK-002 (Enhancement API returning streaming response)

## Outputs
- `/js/enhance-display.js` — New file

## Acceptance Criteria

### Streaming Display
- [ ] Content appears progressively as it streams from API
- [ ] No layout jump when content arrives
- [ ] Smooth text appearance (no flicker)

### Output Structure
- [ ] Title displays at top (18px, weight 500)
- [ ] Date displays below title (13px, gray-500)
- [ ] "✨ enhanced" badge in top-right (13px, gray-400)
- [ ] Section headers: DISCUSSED, ACTION ITEMS, NOTED, etc.
- [ ] Section headers styled: 11px, uppercase, letter-spacing 0.1em, gray-600

### Content Styling
- [ ] Bullet points use • character
- [ ] Action items use → prefix
- [ ] Warnings use ⚠️ prefix
- [ ] AI-generated text: color gray-600 (#525252)
- [ ] User-written text: color black (#000000)

### Inscript Context Section
- [ ] Visually distinct: gray-50 background, 2px left border (silver)
- [ ] Header: "INSCRIPT CONTEXT" (11px, uppercase, gray-500)
- [ ] Items with icons: ℹ️ (info), ⚠️ (warning), 🔗 (link)
- [ ] Subtext indented below main text (13px, gray-500)
- [ ] Links clickable

### Action Buttons
- [ ] "Try Again" button (ghost style: border, no fill)
- [ ] "Save" button (primary style: black bg, white text)
- [ ] Buttons in row at bottom with border-top separator

## CSS Specs

```css
.enhanced-output {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px;
}

.enhanced-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.enhanced-title {
  font-size: 18px;
  font-weight: 500;
  color: #171717;
}

.enhanced-badge {
  font-size: 13px;
  color: #A3A3A3;
}

.enhanced-date {
  font-size: 13px;
  color: #737373;
  margin-bottom: 24px;
}

.enhanced-section {
  margin-bottom: 24px;
}

.enhanced-section-header {
  font-size: 11px;
  font-weight: 500;
  color: #525252;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.content-ai {
  color: #525252;
}

.content-user {
  color: #000000;
}

.inscript-context {
  background: #FAFAFA;
  border-left: 2px solid #C0C0C0;
  padding: 24px;
  margin-top: 32px;
}

.inscript-context-header {
  font-size: 11px;
  font-weight: 500;
  color: #737373;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.inscript-context-item {
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #525252;
}

.inscript-context-item .subtext {
  display: block;
  font-size: 13px;
  color: #737373;
  margin-top: 4px;
  padding-left: 24px;
}

.enhanced-actions {
  display: flex;
  gap: 16px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #E5E5E5;
}

.btn-ghost {
  flex: 1;
  padding: 12px 24px;
  background: transparent;
  color: #000000;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #E5E5E5;
  cursor: pointer;
}

.btn-ghost:hover {
  border-color: #000000;
}

.btn-primary {
  flex: 1;
  padding: 12px 24px;
  background: #000000;
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}
```

## Component Structure

```javascript
// js/enhance-display.js

export class EnhanceDisplay {
  constructor(container) {
    this.container = container;
    this.content = '';
    this.context = [];
    this.metadata = null;
  }

  // Called when metadata event arrives
  setMetadata(metadata) {
    this.metadata = metadata;
    this.renderHeader();
  }

  // Called for each content chunk
  appendContent(text) {
    this.content += text;
    this.renderContent();
  }

  // Called for each context item
  addContextItem(item) {
    this.context.push(item);
    this.renderContext();
  }

  // Called when streaming completes
  complete(noteId) {
    this.noteId = noteId;
    this.renderActions();
  }

  renderHeader() {
    // Render title, date, badge
  }

  renderContent() {
    // Parse markdown-like content into sections
    // Render with proper styling
  }

  renderContext() {
    // Render Inscript Context section
  }

  renderActions() {
    // Render Try Again and Save buttons
  }

  onTryAgain(callback) {
    // Wire up Try Again button
  }

  onSave(callback) {
    // Wire up Save button
  }
}
```

## Streaming Integration

```javascript
// In meeting-capture.js, after calling API:

const display = new EnhanceDisplay(outputContainer);

const response = await fetch('/api/enhance-meeting', { ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      if (data.type === 'metadata') {
        display.setMetadata(data.metadata);
      } else if (data.type === 'content') {
        display.appendContent(data.text);
      } else if (data.type === 'context') {
        display.addContextItem(data.item);
      } else if (data.type === 'done') {
        display.complete(data.noteId);
      }
    }
  }
}
```

## Test Checklist

- [ ] Streaming text appears progressively
- [ ] Section headers formatted correctly
- [ ] Inscript Context has distinct background
- [ ] Icons display correctly (ℹ️ ⚠️ 🔗)
- [ ] Try Again button works
- [ ] Save button works
- [ ] Mobile responsive at 375px
- [ ] No shadows anywhere
- [ ] All colors from design system only
