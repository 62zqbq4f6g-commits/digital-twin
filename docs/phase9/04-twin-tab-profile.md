# Phase 9: TWIN Tab Profile Redesign

## Current State

The TWIN tab currently shows:
- "the living script / a mirror in code" header
- ABOUT YOU section with freeform fields
- WHAT I'VE LEARNED section (entities, patterns, stats)

## New Structure

```
┌─────────────────────────────────────┐
│         the living script           │
│           a mirror in code          │
├─────────────────────────────────────┤
│  ABOUT YOU                          │
│  ─────────────────────────────────  │
│  [Profile fields from onboarding]   │
├─────────────────────────────────────┤
│  YOUR PREFERENCES                   │  ← NEW: Unlocks after 5 notes
│  ─────────────────────────────────  │
│  [Tone, context, key people, etc]   │
├─────────────────────────────────────┤
│  WHAT I'VE LEARNED                  │  ← Existing, keep
│  ─────────────────────────────────  │
│  [YOUR WORLD, patterns, stats]      │
└─────────────────────────────────────┘
```

---

## Section 1: ABOUT YOU

Displays onboarding data with edit capability.

```
┌─────────────────────────────────────┐
│  ABOUT YOU                          │  ← .section-header
│  ─────────────────────────────────  │
│                                     │
│  YOUR NAME                          │  ← .label
│  Rox                           [✎]  │  ← value + edit icon
│                                     │
│  YOUR DAYS                          │
│  Building something            [✎]  │
│                                     │
│  YOU'RE HERE TO                     │
│  Think through decisions,      [✎]  │
│  Understand myself better           │
│                                     │
└─────────────────────────────────────┘
```

**HTML Structure:**
```html
<div class="profile-section">
  <h3 class="section-header">About You</h3>
  
  <div class="profile-field">
    <span class="label">Your Name</span>
    <div class="profile-field__row">
      <span class="profile-field__value" id="profile-name">Rox</span>
      <button class="profile-field__edit" data-field="name">
        <svg class="icon"><!-- pencil icon --></svg>
      </button>
    </div>
  </div>
  
  <!-- Repeat for role, goals -->
</div>
```

**CSS:**
```css
.profile-field {
  margin-bottom: var(--space-4);
}

.profile-field__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-field__value {
  font: var(--type-body);
  color: var(--ink-800);
}

.profile-field__edit {
  background: none;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  opacity: 0.4;
  transition: opacity var(--duration-fast);
}

.profile-field__edit:hover {
  opacity: 1;
}
```

---

## Section 2: YOUR PREFERENCES

Unlocks after 5 notes. Shows additional personalization options.

```
┌─────────────────────────────────────┐
│  YOUR PREFERENCES                   │  ← .section-header
│  ─────────────────────────────────  │
│                                     │
│  HOW I SPEAK TO YOU                 │
│  Not set                       [+]  │  ← "Not set" when empty
│                                     │
│  WHAT'S ON YOUR PLATE               │
│  Raising a seed round...       [✎]  │  ← Truncated preview
│                                     │
│  KEY PEOPLE                         │
│  3 people                      [✎]  │  ← Count summary
│                                     │
│  TOPICS TO AVOID                    │
│  None set                      [+]  │
│                                     │
└─────────────────────────────────────┘
```

**Locked State (< 5 notes):**
```
┌─────────────────────────────────────┐
│  YOUR PREFERENCES                   │
│  ─────────────────────────────────  │
│                                     │
│  🔒 Unlocks after 5 notes           │  ← --ink-400, centered
│     You have 3 notes                │
│                                     │
└─────────────────────────────────────┘
```

---

## Edit Modals

### Edit Name Modal

```
┌─────────────────────────────────────┐
│  YOUR NAME                     [×]  │
│                                     │
│  [Rox_________________________]     │  ← .input
│                                     │
│              [ Save ]               │
└─────────────────────────────────────┘
```

### Edit Role Modal

```
┌─────────────────────────────────────┐
│  WHAT DESCRIBES YOUR DAYS?     [×]  │
│                                     │
│  ○ Building something               │  ← Same options as onboarding
│    founder, creator                 │
│                                     │
│  ● Leading others                   │  ← Current selection filled
│    manager, exec, team lead         │
│                                     │
│  ○ Deep in the work                 │
│    specialist, maker                │
│                                     │
│  ... (all 6 options)                │
│                                     │
│              [ Save ]               │
└─────────────────────────────────────┘
```

### Edit Goals Modal

```
┌─────────────────────────────────────┐
│  WHAT BRINGS YOU HERE?         [×]  │
│  Select 1–3                         │
│                                     │
│  [Think through  ✓] [Process what ] │  ← Pills, same as onboarding
│  [Stay on top    ] [Understand  ✓] │
│  [Remember what  ] [Just exploring] │
│                                     │
│              [ Save ]               │
└─────────────────────────────────────┘
```

### Edit Tone Modal

```
┌─────────────────────────────────────┐
│  HOW SHOULD I SPEAK TO YOU?    [×]  │
│                                     │
│  ○ Direct and efficient             │
│    Get to the point, no fluff       │
│                                     │
│  ● Warm and supportive              │
│    Gentle, encouraging              │
│                                     │
│  ○ Challenge me                     │
│    Push back, ask hard questions    │
│                                     │
│  ○ Let me adapt                     │
│    Match my energy each time        │
│                                     │
│              [ Save ]               │
└─────────────────────────────────────┘
```

### Edit Life Context Modal

```
┌─────────────────────────────────────┐
│  WHAT'S ON YOUR PLATE?         [×]  │
│  A sentence about what you're       │
│  navigating right now               │
│                                     │
│  [Raising a seed round while____]   │  ← textarea, 2-3 lines
│  [trying to be present for______]   │
│  [my family____________________]    │
│                                     │
│  120 / 200 characters               │  ← char count
│                                     │
│              [ Save ]               │
└─────────────────────────────────────┘
```

### Edit Key People Modal

```
┌─────────────────────────────────────┐
│  KEY PEOPLE                    [×]  │
│  People your Twin should know       │
│                                     │
│  Sarah                              │
│  cofounder                     [×]  │  ← delete button
│  ─────────────────────────────────  │
│  Mom                                │
│  family                        [×]  │
│  ─────────────────────────────────  │
│                                     │
│  + Add person                       │  ← expands inline form
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Name: [________________]    │    │  ← inline add form
│  │ Relationship: [________]    │    │
│  │         [Add]  [Cancel]     │    │
│  └─────────────────────────────┘    │
│                                     │
│              [ Done ]               │
└─────────────────────────────────────┘
```

### Edit Boundaries Modal

```
┌─────────────────────────────────────┐
│  TOPICS TO AVOID               [×]  │
│  Your Twin won't probe these        │
│                                     │
│  [health ×] [ex-partner ×]          │  ← tag chips
│                                     │
│  [Add topic___________] [+]         │  ← input + add button
│                                     │
│              [ Done ]               │
└─────────────────────────────────────┘
```

---

## Modal Component

Reusable modal structure:

```html
<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <div class="modal__header">
      <h3 class="modal__title">Modal Title</h3>
      <button class="modal__close" onclick="closeModal()">×</button>
    </div>
    <div class="modal__body">
      <!-- Content -->
    </div>
    <div class="modal__footer">
      <button class="btn-primary" onclick="saveModal()">Save</button>
    </div>
  </div>
</div>
```

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: all var(--duration-normal);
}

.modal-overlay--visible {
  opacity: 1;
  visibility: visible;
}

.modal {
  background: var(--paper-pure);
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  transform: translateY(20px);
  transition: transform var(--duration-normal) var(--ease-out);
}

.modal-overlay--visible .modal {
  transform: translateY(0);
}

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--ink-100);
}

.modal__title {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-600);
}

.modal__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--ink-400);
  cursor: pointer;
  padding: var(--space-2);
}

.modal__body {
  padding: var(--space-5);
}

.modal__footer {
  padding: var(--space-4);
  border-top: 1px solid var(--ink-100);
  text-align: center;
}
```

---

## Implementation Notes

1. **Fetch profile on TWIN tab load:**
```javascript
async function loadProfile() {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}
```

2. **Check unlock status:**
```javascript
async function checkPreferencesUnlocked(profile) {
  const { count } = await supabase
    .from('notes')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);
  
  if (count >= 5 && !profile.preferences_unlocked_at) {
    await supabase
      .from('user_profiles')
      .update({ preferences_unlocked_at: new Date() })
      .eq('user_id', userId);
  }
  
  return count >= 5;
}
```

3. **Save edits:**
```javascript
async function saveProfileField(field, value) {
  await supabase
    .from('user_profiles')
    .update({ [field]: value, updated_at: new Date() })
    .eq('user_id', userId);
  
  closeModal();
  refreshProfileDisplay();
}
```

---

## File Location

Add to existing TWIN tab rendering in ui.js, or create:
```
js/ui-profile.js
├── renderProfileSection()
├── renderPreferencesSection()
├── openEditModal(field)
├── closeModal()
├── saveProfileField(field, value)
└── Modal HTML generators
```
