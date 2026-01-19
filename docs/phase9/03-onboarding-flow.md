# Phase 9: Onboarding Flow

## Overview

3 screens + welcome. Total time: ~60 seconds. 
Goal: Capture enough context for immediate personalization without friction.

---

## Screen 0: Welcome

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                                     │
│         the living script           │  ← Playfair Display, --type-display
│           a mirror in code          │  ← Inter, --type-body-small, --ink-400
│                                     │
│                                     │
│                                     │
│         [ Get Started ]             │  ← .btn-primary, centered
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Animation:** Text fades in with staggered delay (300ms between lines)

---

## Screen 1: Name

```
┌─────────────────────────────────────┐
│                                     │
│  ← Back                    1 of 3   │  ← --type-caption, --ink-400
│                                     │
│                                     │
│  YOUR NAME                          │  ← .label
│  ─────────────────────────────────  │
│  [What should I call you?       ]   │  ← .input, italic placeholder
│                                     │
│                                     │
│                                     │
│         [ Continue ]                │  ← disabled until name entered
│                                     │
└─────────────────────────────────────┘
```

**Validation:** Name must be 1+ characters. Trim whitespace.

---

## Screen 2: Role

```
┌─────────────────────────────────────┐
│                                     │
│  ← Back                    2 of 3   │
│                                     │
│  WHAT DESCRIBES YOUR DAYS?          │  ← .label
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ○  Building something       │    │  ← .option-card
│  │    founder, creator         │    │  ← .option-card__subtitle
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ●  Leading others           │    │  ← .option-card--selected
│  │    manager, exec, team lead │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ○  Deep in the work         │    │
│  │    specialist, maker        │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ○  Learning & exploring     │    │
│  │    student, career change   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ○  Juggling multiple things │    │
│  │    freelancer, caregiver    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ○  Between chapters         │    │
│  │    transitioning, searching │    │
│  └─────────────────────────────┘    │
│                                     │
│         [ Continue ]                │
│                                     │
└─────────────────────────────────────┘
```

**Data:**
```javascript
const ROLE_OPTIONS = [
  { value: 'BUILDING', title: 'Building something', subtitle: 'founder, creator, solopreneur' },
  { value: 'LEADING', title: 'Leading others', subtitle: 'manager, exec, team lead' },
  { value: 'MAKING', title: 'Deep in the work', subtitle: 'specialist, maker, IC' },
  { value: 'LEARNING', title: 'Learning & exploring', subtitle: 'student, career change, sabbatical' },
  { value: 'JUGGLING', title: 'Juggling multiple things', subtitle: 'freelancer, portfolio, caregiver' },
  { value: 'TRANSITIONING', title: 'Between chapters', subtitle: 'transitioning, searching, reflecting' }
];
```

**Validation:** Must select one option.

---

## Screen 3: Goals

```
┌─────────────────────────────────────┐
│                                     │
│  ← Back                    3 of 3   │
│                                     │
│  WHAT BRINGS YOU HERE?              │  ← .label
│  Select 1–3 that resonate           │  ← --type-caption, --ink-400
│                                     │
│  ┌────────────────┐ ┌──────────────┐│
│  │ Think through  │ │ Process what ││  ← .pill (2-column grid)
│  │ decisions   ☑  │ │ happened     ││
│  └────────────────┘ └──────────────┘│
│                                     │
│  ┌────────────────┐ ┌──────────────┐│
│  │ Stay on top    │ │ Understand   ││
│  │ of things      │ │ myself    ☑  ││
│  └────────────────┘ └──────────────┘│
│                                     │
│  ┌────────────────┐ ┌──────────────┐│
│  │ Remember what  │ │ Just         ││
│  │ matters        │ │ exploring    ││
│  └────────────────┘ └──────────────┘│
│                                     │
│                                     │
│       [ Start Writing ]             │
│                                     │
└─────────────────────────────────────┘
```

**Data:**
```javascript
const GOAL_OPTIONS = [
  { value: 'DECISIONS', label: 'Think through decisions' },
  { value: 'PROCESS', label: 'Process what happened' },
  { value: 'ORGANIZE', label: 'Stay on top of things' },
  { value: 'SELF_UNDERSTANDING', label: 'Understand myself better' },
  { value: 'REMEMBER', label: 'Remember what matters' },
  { value: 'EXPLORING', label: 'Just exploring' }
];
```

**Validation:** Must select 1-3 options. Show subtle error if 0 or >3 selected.

**Grid CSS:**
```css
.goal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.goal-pill {
  font: var(--type-body-small);
  color: var(--ink-600);
  background: var(--paper);
  border: 1px solid var(--ink-200);
  padding: var(--space-3) var(--space-4);
  text-align: center;
  cursor: pointer;
}

.goal-pill--selected {
  background: var(--ink-900);
  color: var(--paper-pure);
  border-color: var(--ink-900);
}

.goal-pill--selected::after {
  content: ' ✓';
}
```

---

## Save Logic

On "Start Writing" click:

```javascript
async function completeOnboarding(data) {
  const { name, roleType, goals } = data;
  const userId = getCurrentUserId();
  
  // Insert into user_profiles
  await supabase.from('user_profiles').insert({
    user_id: userId,
    name: name.trim(),
    role_type: roleType,
    goals: goals,
    onboarding_completed_at: new Date().toISOString()
  });
  
  // Initialize empty learning profile
  await supabase.from('user_learning_profile').insert({
    user_id: userId
  });
  
  // Navigate to main app
  showNotesScreen();
}
```

---

## Check Logic (on app load)

```javascript
async function checkOnboardingStatus() {
  const userId = getCurrentUserId();
  if (!userId) return; // Not logged in
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', userId)
    .single();
  
  if (!profile || !profile.onboarding_completed_at) {
    showOnboarding();
  } else {
    showNotesScreen();
  }
}
```

---

## File Structure Suggestion

Create as new file to avoid bloating ui.js:

```
js/onboarding.js
├── showOnboarding()
├── renderWelcomeScreen()
├── renderNameScreen()
├── renderRoleScreen()
├── renderGoalsScreen()
├── completeOnboarding()
└── checkOnboardingStatus()
```

Import in index.html and call `checkOnboardingStatus()` in init.
