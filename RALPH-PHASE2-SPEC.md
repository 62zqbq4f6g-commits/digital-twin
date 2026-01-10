# Ralph Loop Spec: Digital Twin Phase 2

**Build Method:** Ralph Wiggum Loop (Autonomous)  
**Scope:** Image Input, Vision OCR/Description, Weekly Digest  
**Design Aesthetic:** Minimalist Soho NYC (Pentagram, Collins, Mother Design)  
**Estimated Build:** 2-3 hours

---

## Prerequisites

Before starting, ensure Phase 1 is complete:
- Digital Twin PWA running at `~/Projects/digital-twin`
- Claude API integration working via `/api/refine` endpoint
- Vercel dev server functional
- Existing files: `index.html`, `js/`, `css/styles.css`, `api/refine.js`

---

## Overview

### Features to Build

| Feature | Description | Priority |
|---------|-------------|----------|
| **Image Capture** | Camera/gallery input on mobile | P1 |
| **Vision Processing** | Claude Vision API for OCR + description | P1 |
| **Weekly Digest** | AI-generated summary of week's notes | P2 |

### Architecture Addition

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIGITAL TWIN PWA v2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   INPUT LAYER (Updated)                                         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│   │  Voice  │  │  Text   │  │  Image  │  ← NEW                 │
│   │   🎤    │  │   ⌨️    │  │   📷    │                        │
│   └────┬────┘  └────┬────┘  └────┬────┘                        │
│        │            │            │                              │
│        ▼            ▼            ▼                              │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              PROCESSING (Claude API)                     │  │
│   │  Text → /api/refine (Sonnet 3.5)                        │  │
│   │  Image → /api/vision (Sonnet 3.5 Vision) ← NEW          │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │              IndexedDB (notes + images)                  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│   OUTPUT LAYER (Updated)                                        │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐                  │
│   │   View    │  │   Copy    │  │  Digest   │ ← NEW            │
│   └───────────┘  └───────────┘  └───────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Image Capture

### 1.1 UI Design

**Capture Screen Update:**

The capture screen should add an image button alongside voice/text. Maintain the minimalist aesthetic.

```
┌─────────────────────────────────────┐
│                                     │
│  Digital Twin              ≡        │
│                                     │
│                                     │
│         ┌───────────────┐           │
│         │               │           │
│         │    ◉          │           │
│         │               │           │
│         │  Tap to speak │           │
│         │               │           │
│         └───────────────┘           │
│                                     │
│         or type below               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ What's on your mind?        │    │
│  └─────────────────────────────┘    │
│                                     │
│              ───►                   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│        📷 Add Image                 │  ← NEW: Subtle link
│                                     │
│  RECENT                             │
│  ...                                │
│                                     │
└─────────────────────────────────────┘
```

**Image Preview State (after capture):**

```
┌─────────────────────────────────────┐
│                                     │
│  Digital Twin              ≡        │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │     [Image Preview]         │    │
│  │     (thumbnail)             │    │
│  │                       ✕     │    │  ← Remove button
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Add context (optional)...   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      Process Image          │    │  ← Black button
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 1.2 Implementation

**File: `js/camera.js`** (New)

```javascript
// Camera/Gallery Input Handler
const Camera = {
  currentImage: null,
  
  init() {
    this.setupEventListeners();
  },
  
  setupEventListeners() {
    const imageBtn = document.getElementById('image-btn');
    const imageInput = document.getElementById('image-input');
    const removeBtn = document.getElementById('remove-image');
    const processBtn = document.getElementById('process-image-btn');
    
    imageBtn?.addEventListener('click', () => imageInput.click());
    imageInput?.addEventListener('change', (e) => this.handleImageSelect(e));
    removeBtn?.addEventListener('click', () => this.clearImage());
    processBtn?.addEventListener('click', () => this.processImage());
  },
  
  handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB for API)
    if (file.size > 5 * 1024 * 1024) {
      UI.showToast('Image too large. Max 5MB.');
      return;
    }
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentImage = {
        base64: e.target.result,
        type: file.type,
        name: file.name
      };
      this.showPreview();
    };
    reader.readAsDataURL(file);
  },
  
  showPreview() {
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');
    
    previewImg.src = this.currentImage.base64;
    captureSection.classList.add('hidden');
    imageSection.classList.remove('hidden');
  },
  
  clearImage() {
    this.currentImage = null;
    const captureSection = document.getElementById('capture-section');
    const imageSection = document.getElementById('image-section');
    const imageInput = document.getElementById('image-input');
    
    captureSection.classList.remove('hidden');
    imageSection.classList.add('hidden');
    imageInput.value = '';
  },
  
  async processImage() {
    if (!this.currentImage) return;
    
    const contextInput = document.getElementById('image-context');
    const context = contextInput?.value || '';
    
    UI.showProcessing('Analyzing image...');
    
    try {
      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: this.currentImage.base64,
          context: context
        })
      });
      
      if (!response.ok) throw new Error('Vision API failed');
      
      const result = await response.json();
      
      // Save note with image
      const note = await this.createImageNote(result);
      await DB.saveNote(note);
      
      UI.hideProcessing();
      UI.showToast('Image processed!');
      this.clearImage();
      
      // Show the result
      App.showNoteDetail(note.id);
      
    } catch (error) {
      console.error('Vision processing error:', error);
      UI.hideProcessing();
      UI.showToast('Failed to process image');
    }
  },
  
  async createImageNote(visionResult) {
    const now = new Date();
    
    return {
      id: generateId(),
      version: '1.0',
      timestamps: {
        created_at: now.toISOString(),
        input_date: now.toISOString().split('T')[0],
        input_time: now.toTimeString().slice(0, 5),
        input_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' })
      },
      input: {
        type: 'image',
        raw_text: visionResult.extracted_text || '',
        image_description: visionResult.description,
        image_thumbnail: this.currentImage.base64 // Store for display
      },
      classification: {
        category: visionResult.category || 'personal',
        confidence: visionResult.confidence || 0.7
      },
      extracted: {
        title: visionResult.title,
        topics: visionResult.topics || [],
        action_items: visionResult.action_items || [],
        sentiment: visionResult.sentiment || 'neutral',
        people: visionResult.people || []
      },
      refined: {
        summary: visionResult.summary,
        formatted_output: visionResult.formatted_output
      }
    };
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => Camera.init());
```

**File: `api/vision.js`** (New Vercel Serverless Function)

```javascript
// Vercel Serverless Function for Claude Vision
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { image, context } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }
    
    // Extract base64 data (remove data:image/...;base64, prefix)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: `Analyze this image and extract information for a personal note-taking system.

${context ? `User context: "${context}"` : ''}

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "title": "Brief descriptive title (max 50 chars)",
  "description": "What the image shows (1-2 sentences)",
  "extracted_text": "Any text visible in the image (OCR). Empty string if no text.",
  "category": "work|personal|health|ideas",
  "confidence": 0.8,
  "summary": "Professional 2-3 sentence summary of the image content",
  "topics": ["topic1", "topic2"],
  "action_items": ["action if any visible tasks/todos"],
  "people": ["names if any visible"],
  "sentiment": "positive|neutral|negative",
  "formatted_output": "# Title\\n\\n**Date**\\n**📷 Image**\\n\\n---\\n\\n## Description\\n\\n[description]\\n\\n---\\n\\n## Extracted Text\\n\\n[text if any]\\n\\n---\\n\\n## Action Items\\n\\n☐ [items]\\n\\n---\\n\\n*Captured by Digital Twin*"
}`
              }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Claude Vision API error:', error);
      return res.status(500).json({ error: 'Vision API request failed' });
    }
    
    const data = await response.json();
    const content = data.content[0]?.text || '';
    
    // Parse JSON response
    let result;
    try {
      // Clean potential markdown code blocks
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback
      result = {
        title: 'Image Capture',
        description: content,
        extracted_text: '',
        category: 'personal',
        confidence: 0.5,
        summary: content,
        topics: [],
        action_items: [],
        people: [],
        sentiment: 'neutral',
        formatted_output: `# Image Capture\n\n${content}`
      };
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Vision handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 1.3 HTML Updates

Add to `index.html` in the capture section:

```html
<!-- Image Input (hidden) -->
<input type="file" id="image-input" accept="image/*" capture="environment" class="hidden">

<!-- Add Image Button (below text input) -->
<button id="image-btn" class="image-add-btn">
  <span class="image-icon">📷</span>
  <span>Add Image</span>
</button>

<!-- Image Preview Section (hidden by default) -->
<section id="image-section" class="hidden">
  <div class="image-preview-container">
    <img id="image-preview" alt="Preview">
    <button id="remove-image" class="remove-image-btn">✕</button>
  </div>
  
  <textarea 
    id="image-context" 
    class="image-context-input"
    placeholder="Add context (optional)..."
    rows="2"
  ></textarea>
  
  <button id="process-image-btn" class="btn-primary btn-full">
    Process Image
  </button>
</section>
```

### 1.4 CSS Updates

Add to `css/styles.css`:

```css
/* ================================
   IMAGE CAPTURE STYLES
   ================================ */

/* Add Image Button - Minimal link style */
.image-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  background: none;
  border: none;
  color: var(--color-gray-400);
  font-size: var(--text-caption);
  padding: var(--space-md) 0;
  cursor: pointer;
  transition: color var(--transition-fast);
  width: 100%;
}

.image-add-btn:hover {
  color: var(--color-black);
}

.image-icon {
  font-size: 1.2em;
}

/* Image Preview Container */
.image-preview-container {
  position: relative;
  width: 100%;
  max-width: 300px;
  margin: 0 auto var(--space-lg);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-gray-100);
}

#image-preview {
  width: 100%;
  height: auto;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-black);
  color: var(--color-white);
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity var(--transition-fast);
}

.remove-image-btn:hover {
  opacity: 0.8;
}

/* Image Context Input */
.image-context-input {
  width: 100%;
  padding: var(--space-md);
  border: 1px solid var(--color-gray-100);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  resize: none;
  margin-bottom: var(--space-md);
  background: var(--color-gray-50);
}

.image-context-input:focus {
  outline: none;
  border-color: var(--color-black);
  background: var(--color-white);
}

.image-context-input::placeholder {
  color: var(--color-gray-400);
}

/* Full width button */
.btn-full {
  width: 100%;
}

/* Image indicator in note cards */
.note-card-image-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-micro);
  color: var(--color-gray-400);
}

/* Image in note detail */
.note-detail-image {
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-lg);
  margin: var(--space-lg) 0;
  border: 1px solid var(--color-gray-100);
}

/* Processing overlay */
.processing-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.processing-spinner {
  width: 40px;
  height: 40px;
  border: 2px solid var(--color-gray-100);
  border-top-color: var(--color-black);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.processing-text {
  margin-top: var(--space-md);
  font-size: var(--text-body);
  color: var(--color-gray-600);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Hidden utility */
.hidden {
  display: none !important;
}
```

---

## Feature 2: Weekly Digest

### 2.1 UI Design

**Digest Access:**

Add a "Digest" tab to the bottom navigation, or a button in Settings/Notes screen.

```
┌─────────────────────────────────────┐
│                                     │
│  Weekly Digest             ✕        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  JANUARY 6 - 12, 2025               │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  OVERVIEW                           │
│                                     │
│  You captured 23 notes this week    │
│  across 4 categories.               │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  💼 WORK (12 notes)                 │
│                                     │
│  Key themes: Trust partnership,     │
│  Velolume API, investor meetings    │
│                                     │
│  Highlights:                        │
│  • Trust company interested in JV   │
│  • API integration progressing      │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  💪 HEALTH (5 notes)                │
│                                     │
│  Mood trend: Positive               │
│  Energy: Consistent                 │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🏠 PERSONAL (4 notes)              │
│                                     │
│  ...                                │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  💡 IDEAS (2 notes)                 │
│                                     │
│  • MCP integration concept          │
│  • Creator monetization strategy    │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  OPEN ACTION ITEMS (8)              │
│                                     │
│  ☐ Wait for trust proposal          │
│  ☐ Schedule team workshop           │
│  ☐ Follow up with investor          │
│  ...                                │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     📋 Copy Digest          │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 2.2 Implementation

**File: `js/digest.js`** (New)

```javascript
// Weekly Digest Generator
const Digest = {
  
  async generate() {
    UI.showProcessing('Generating digest...');
    
    try {
      // Get this week's notes
      const weekStart = this.getWeekStart();
      const weekEnd = this.getWeekEnd();
      const notes = await DB.getNotesByDateRange(weekStart, weekEnd);
      
      if (notes.length === 0) {
        UI.hideProcessing();
        UI.showToast('No notes this week');
        return null;
      }
      
      // Prepare notes summary for API
      const notesSummary = notes.map(n => ({
        date: n.timestamps.input_date,
        category: n.classification.category,
        title: n.extracted.title,
        summary: n.refined.summary,
        action_items: n.extracted.action_items,
        sentiment: n.extracted.sentiment
      }));
      
      // Call digest API
      const response = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesSummary,
          weekStart: weekStart,
          weekEnd: weekEnd
        })
      });
      
      if (!response.ok) throw new Error('Digest API failed');
      
      const digest = await response.json();
      
      UI.hideProcessing();
      this.showDigest(digest, weekStart, weekEnd, notes.length);
      
      return digest;
      
    } catch (error) {
      console.error('Digest generation error:', error);
      UI.hideProcessing();
      UI.showToast('Failed to generate digest');
      return null;
    }
  },
  
  getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  },
  
  getWeekEnd() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? 0 : 7); // Sunday
    const sunday = new Date(now.setDate(diff));
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString().split('T')[0];
  },
  
  showDigest(digest, weekStart, weekEnd, noteCount) {
    const modal = document.getElementById('digest-modal');
    const content = document.getElementById('digest-content');
    
    const startDate = new Date(weekStart);
    const endDate = new Date(weekEnd);
    const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    content.innerHTML = `
      <div class="digest-header">
        <h2 class="digest-title">Weekly Digest</h2>
        <span class="digest-date">${dateRange}</span>
      </div>
      
      <div class="digest-section">
        <h3 class="digest-section-title">Overview</h3>
        <p class="digest-text">${digest.overview}</p>
      </div>
      
      ${digest.categories.map(cat => `
        <div class="digest-section">
          <h3 class="digest-section-title">${this.getCategoryIcon(cat.name)} ${cat.name.toUpperCase()} (${cat.count} notes)</h3>
          ${cat.themes ? `<p class="digest-themes">Key themes: ${cat.themes}</p>` : ''}
          ${cat.highlights && cat.highlights.length > 0 ? `
            <div class="digest-highlights">
              <p class="digest-label">Highlights:</p>
              <ul class="digest-list">
                ${cat.highlights.map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${cat.mood ? `<p class="digest-mood">Mood trend: ${cat.mood}</p>` : ''}
        </div>
      `).join('')}
      
      ${digest.action_items && digest.action_items.length > 0 ? `
        <div class="digest-section">
          <h3 class="digest-section-title">Open Action Items (${digest.action_items.length})</h3>
          <ul class="digest-actions">
            ${digest.action_items.map(a => `<li>☐ ${a}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${digest.insights ? `
        <div class="digest-section">
          <h3 class="digest-section-title">Insights</h3>
          <p class="digest-text">${digest.insights}</p>
        </div>
      ` : ''}
      
      <button class="btn-primary btn-full" onclick="Digest.copyDigest()">
        📋 Copy Digest
      </button>
    `;
    
    // Store for copying
    this.currentDigest = digest;
    this.currentDateRange = dateRange;
    
    modal.classList.remove('hidden');
  },
  
  getCategoryIcon(category) {
    const icons = {
      work: '💼',
      personal: '🏠',
      health: '💪',
      ideas: '💡'
    };
    return icons[category.toLowerCase()] || '📝';
  },
  
  closeDigest() {
    const modal = document.getElementById('digest-modal');
    modal.classList.add('hidden');
  },
  
  async copyDigest() {
    if (!this.currentDigest) return;
    
    const text = this.formatDigestForCopy();
    
    try {
      await navigator.clipboard.writeText(text);
      UI.showToast('Digest copied!');
    } catch (error) {
      console.error('Copy failed:', error);
      UI.showToast('Failed to copy');
    }
  },
  
  formatDigestForCopy() {
    const d = this.currentDigest;
    
    let text = `# Weekly Digest\n\n`;
    text += `**${this.currentDateRange}**\n\n`;
    text += `---\n\n`;
    text += `## Overview\n\n${d.overview}\n\n`;
    
    d.categories.forEach(cat => {
      text += `---\n\n`;
      text += `## ${this.getCategoryIcon(cat.name)} ${cat.name.charAt(0).toUpperCase() + cat.name.slice(1)} (${cat.count} notes)\n\n`;
      if (cat.themes) text += `**Key themes:** ${cat.themes}\n\n`;
      if (cat.highlights && cat.highlights.length > 0) {
        text += `**Highlights:**\n`;
        cat.highlights.forEach(h => text += `• ${h}\n`);
        text += `\n`;
      }
      if (cat.mood) text += `**Mood trend:** ${cat.mood}\n\n`;
    });
    
    if (d.action_items && d.action_items.length > 0) {
      text += `---\n\n`;
      text += `## Open Action Items\n\n`;
      d.action_items.forEach(a => text += `☐ ${a}\n`);
      text += `\n`;
    }
    
    if (d.insights) {
      text += `---\n\n`;
      text += `## Insights\n\n${d.insights}\n\n`;
    }
    
    text += `---\n\n*Generated by Digital Twin*`;
    
    return text;
  }
};

// Export for global access
window.Digest = Digest;
```

**File: `api/digest.js`** (New Vercel Serverless Function)

```javascript
// Vercel Serverless Function for Weekly Digest
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { notes, weekStart, weekEnd } = req.body;
    
    if (!notes || notes.length === 0) {
      return res.status(400).json({ error: 'No notes provided' });
    }
    
    const prompt = `Generate a weekly digest from these notes. Be concise and insightful.

Notes from ${weekStart} to ${weekEnd}:

${JSON.stringify(notes, null, 2)}

Respond with ONLY valid JSON (no markdown, no code blocks):

{
  "overview": "2-3 sentence overview of the week. Mention total notes and general themes.",
  "categories": [
    {
      "name": "work",
      "count": 5,
      "themes": "Main themes (comma separated)",
      "highlights": ["Key highlight 1", "Key highlight 2"]
    },
    {
      "name": "health",
      "count": 3,
      "mood": "Overall mood trend (Positive/Neutral/Negative)"
    },
    {
      "name": "personal",
      "count": 2,
      "highlights": ["Highlight 1"]
    },
    {
      "name": "ideas",
      "count": 1,
      "highlights": ["Idea 1"]
    }
  ],
  "action_items": ["All open action items from the week"],
  "insights": "Optional: Any patterns or insights noticed (1-2 sentences)"
}

Only include categories that have notes. Be specific to the actual content.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return res.status(500).json({ error: 'Digest generation failed' });
    }
    
    const data = await response.json();
    const content = data.content[0]?.text || '';
    
    // Parse JSON
    let digest;
    try {
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      digest = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback digest
      digest = {
        overview: `You captured ${notes.length} notes this week.`,
        categories: [],
        action_items: notes.flatMap(n => n.action_items || []),
        insights: ''
      };
    }
    
    return res.status(200).json(digest);
    
  } catch (error) {
    console.error('Digest handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2.3 HTML Updates

Add digest modal and trigger button to `index.html`:

```html
<!-- Digest Button (in Notes screen or Settings) -->
<button id="digest-btn" class="digest-trigger-btn" onclick="Digest.generate()">
  📊 Weekly Digest
</button>

<!-- Digest Modal -->
<div id="digest-modal" class="modal hidden">
  <div class="modal-content">
    <button class="modal-close" onclick="Digest.closeDigest()">✕</button>
    <div id="digest-content">
      <!-- Populated by JS -->
    </div>
  </div>
</div>
```

### 2.4 CSS Updates

Add to `css/styles.css`:

```css
/* ================================
   DIGEST STYLES
   ================================ */

/* Digest Trigger Button */
.digest-trigger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--text-body);
  color: var(--color-black);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin: var(--space-lg) 0;
  width: 100%;
}

.digest-trigger-btn:hover {
  background: var(--color-gray-100);
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  background: var(--color-white);
  z-index: 100;
  overflow-y: auto;
  padding: var(--space-lg);
}

.modal-content {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: var(--space-2xl);
}

.modal-close {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-100);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 101;
}

.modal-close:hover {
  background: var(--color-gray-100);
}

/* Digest Content */
.digest-header {
  text-align: center;
  margin-bottom: var(--space-xl);
  padding-top: var(--space-xl);
}

.digest-title {
  font-size: var(--text-title);
  font-weight: 700;
  margin-bottom: var(--space-sm);
}

.digest-date {
  font-size: var(--text-caption);
  color: var(--color-gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.digest-section {
  margin-bottom: var(--space-xl);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-gray-100);
}

.digest-section:last-of-type {
  border-bottom: none;
}

.digest-section-title {
  font-size: var(--text-heading);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.digest-text {
  font-size: var(--text-body);
  line-height: 1.6;
  color: var(--color-black);
}

.digest-themes {
  font-size: var(--text-body);
  color: var(--color-gray-600);
  margin-bottom: var(--space-sm);
}

.digest-label {
  font-size: var(--text-caption);
  font-weight: 500;
  color: var(--color-gray-600);
  margin-bottom: var(--space-xs);
}

.digest-list,
.digest-actions {
  list-style: none;
  padding: 0;
  margin: 0;
}

.digest-list li,
.digest-actions li {
  font-size: var(--text-body);
  padding: var(--space-xs) 0;
  padding-left: var(--space-md);
  position: relative;
}

.digest-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--color-gray-400);
}

.digest-mood {
  font-size: var(--text-body);
  color: var(--color-gray-600);
}
```

---

## Feature 3: Database Updates

### 3.1 Update `js/db.js`

Add method for date range queries:

```javascript
// Add to DB object
async getNotesByDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const transaction = this.db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    const index = store.index('by_date');
    
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

---

## UI Utility Updates

### Update `js/ui.js`

Add processing overlay functions:

```javascript
// Add to UI object
showProcessing(message = 'Processing...') {
  let overlay = document.getElementById('processing-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'processing-overlay';
    overlay.className = 'processing-overlay';
    overlay.innerHTML = `
      <div class="processing-spinner"></div>
      <p class="processing-text">${message}</p>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.processing-text').textContent = message;
    overlay.classList.remove('hidden');
  }
},

hideProcessing() {
  const overlay = document.getElementById('processing-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}
```

---

## Build Order

Execute in this order:

1. **Create `api/vision.js`** - Vision API endpoint
2. **Create `api/digest.js`** - Digest API endpoint
3. **Create `js/camera.js`** - Image capture handler
4. **Create `js/digest.js`** - Digest generator
5. **Update `js/db.js`** - Add date range query
6. **Update `js/ui.js`** - Add processing overlay
7. **Update `index.html`** - Add image/digest HTML
8. **Update `css/styles.css`** - Add new styles
9. **Update `sw.js`** - Add new files to cache

---

## Testing Checklist

### Image Capture
- [ ] "Add Image" button visible below text input
- [ ] Tapping opens camera on mobile / file picker on desktop
- [ ] Image preview shows correctly
- [ ] "✕" removes image and returns to capture view
- [ ] Optional context input works
- [ ] "Process Image" calls Vision API
- [ ] Processing spinner shows during API call
- [ ] Resulting note saves to IndexedDB
- [ ] Note shows in list with image indicator
- [ ] Note detail shows image thumbnail

### Vision Processing
- [ ] OCR extracts text from photos of documents
- [ ] Descriptions generated for photos
- [ ] Category auto-detected
- [ ] Action items extracted if visible (e.g., whiteboard todos)

### Weekly Digest
- [ ] "Weekly Digest" button accessible
- [ ] Generates digest from current week's notes
- [ ] Shows category breakdowns with counts
- [ ] Shows aggregated action items
- [ ] "Copy Digest" copies formatted markdown
- [ ] Empty state handled (no notes this week)

### Design
- [ ] Matches existing minimalist black/white aesthetic
- [ ] Typography consistent with design system
- [ ] Animations smooth and subtle
- [ ] Mobile responsive

---

## Environment Variables

Ensure `.env.local` has:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## Deployment Notes

After testing locally with `vercel dev`:

```bash
# Deploy to Vercel
vercel --prod
```

The new API endpoints (`/api/vision`, `/api/digest`) will automatically deploy.

---

## Success Criteria

| Feature | Metric | Target |
|---------|--------|--------|
| Image capture | Works on iOS Safari | ✅ |
| Vision OCR | Extracts readable text | > 90% accuracy |
| Vision describe | Meaningful descriptions | Useful in 3/4 cases |
| Digest generation | Completes | < 5 seconds |
| Digest quality | Shareable without edits | Yes |

---

*End of Ralph Loop Spec - Phase 2*
