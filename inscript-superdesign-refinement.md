# INSCRIPT: SUPERDESIGN SETUP + UI REFINEMENT

> Generated: January 23, 2026
> Objective: Install SuperDesign, fix immediate UI issues, systematically refine all UI to SoHo minimalist editorial standard
>
> **HOW TO USE:** Execute in Claude Code terminal

---

## PHASE 1: FIX IMMEDIATE ISSUE (Knowledge Pulse Black Popup)

Before setting up SuperDesign, fix the critical design violation.

### Step 1: Find the Knowledge Pulse component

```bash
grep -rn "Knowledge.*Pulse\|knowledgePulse\|saved.*pattern\|Noticed\|black.*background" js/*.js css/styles.css | head -30
```

### Step 2: Fix the styling

The popup showing after save has:
- ❌ Black background (violates: black = buttons ONLY)
- ❌ Irrelevant pattern (shows business pattern on personal note)
- ❌ Interrupts capture flow

**Fix Option A (Recommended): Remove pattern, simplify to toast**

Find the component and change to:
```css
/* Save confirmation toast - correct styling */
.save-toast,
.knowledge-pulse {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #1a1a1a;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  /* NO black backgrounds */
}
```

**Fix Option B: If component must show pattern**
- Background: white
- Border: 1px solid var(--silver-200)
- Remove pattern section OR ensure pattern is relevant to current note

### Step 3: Remove irrelevant pattern surfacing

If the toast is pulling random patterns, disable that:
```javascript
// In the save confirmation handler
// BEFORE: Shows random pattern
// AFTER: Just show "✓ Saved"
showSaveToast({ message: '✓ Saved' }); // Remove pattern prop
```

### Step 4: Verify and commit

```bash
# Test the app - save a note, verify white toast appears
git add -A
git commit -m "fix: Remove black background from Knowledge Pulse, simplify save toast"
git push origin main
```

---

## PHASE 2: INSTALL SUPERDESIGN

### Step 1: Install CLI globally

```bash
npm install -g @superdesign/cli@latest
```

### Step 2: Login to SuperDesign

```bash
superdesign login
```

Follow the browser authentication flow.

### Step 3: Add skill to project

```bash
cd /Users/airoxthebox/Projects/digital-twin
npx skills add superdesigndev/superdesign-skill
```

### Step 4: Create SuperDesign directory structure

```bash
mkdir -p .superdesign/replica_html_template
```

---

## PHASE 3: CREATE DESIGN SYSTEM FILE

Create `.superdesign/design-system.md` with the Inscript aesthetic:

```bash
cat > .superdesign/design-system.md << 'EOF'
# Inscript Design System
## SoHo Minimalist Editorial Aesthetic

### Philosophy
Inscript's UI embodies the refined minimalism of contemporary SoHo design agencies. 
Every element earns its place. White space is not empty — it's architecture.
The aesthetic whispers sophistication; it never shouts.

---

## Color Palette (STRICT)

### Primary
- **Background**: `#FFFFFF` (pure white)
- **Paper**: `#FAFAFA` (warm white for cards)
- **Text Primary**: `#1A1A1A` (near-black)
- **Text Secondary**: `#6B6B6B` (gray)

### Accent
- **Silver 100**: `#F5F5F5`
- **Silver 200**: `#E5E5E5`
- **Silver 300**: `#D4D4D4`

### Interactive
- **Black** (buttons ONLY): `#000000`
- **Black Hover**: `#1A1A1A`

### FORBIDDEN
- ❌ No colored backgrounds
- ❌ No gradients
- ❌ No shadows heavier than `0 2px 8px rgba(0,0,0,0.04)`
- ❌ No black backgrounds (except buttons)
- ❌ No borders heavier than 1px

---

## Typography

### Font Stack
- **Primary**: Inter, -apple-system, sans-serif
- **Editorial**: 'Cormorant Garamond', Georgia, serif (loading states, quotes)

### Scale
- **xs**: 11px / 1.4
- **sm**: 13px / 1.5
- **base**: 15px / 1.6
- **lg**: 18px / 1.5
- **xl**: 24px / 1.3
- **2xl**: 32px / 1.2
- **3xl**: 40px / 1.1

### Weight
- **Regular**: 400 (body)
- **Medium**: 500 (labels, buttons)
- **Semibold**: 600 (headings)

---

## Spacing System

Base unit: 4px

- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px
- **3xl**: 64px

---

## Components

### Cards
```css
.card {
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 20px;
}
```

### Buttons
```css
.button-primary {
  background: #000000;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.01em;
}

.button-secondary {
  background: transparent;
  color: #1A1A1A;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  padding: 12px 24px;
}
```

### Inputs
```css
.input {
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 15px;
}

.input:focus {
  border-color: #000000;
  outline: none;
}
```

### Toast / Notifications
```css
.toast {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
```

---

## Interaction Rules

- **Transitions**: 200ms ease-out (never longer)
- **Hover states**: Subtle opacity or border changes
- **No bouncy animations**
- **No color transitions** (too playful)
- **Loading**: Skeleton shimmer, NOT spinners

---

## Refinement Constraints

### ALLOWED
- Increase white space
- Sharpen typography hierarchy
- Simplify visual elements
- Improve alignment precision
- Enhance subtle interactions

### FORBIDDEN
- ❌ Adding decorative elements
- ❌ Introducing new colors
- ❌ Increasing visual complexity
- ❌ Changing established layout structure
- ❌ Adding animations beyond 200ms
- ❌ Any black backgrounds (except buttons)

---

## Quality Checklist

Before approving any refinement:
- [ ] Does it feel like a fashion magazine editorial?
- [ ] Is there confident white space?
- [ ] Are touch targets ≥44px?
- [ ] Is typography hierarchy clear?
- [ ] Are all colors within palette?
- [ ] Is black used ONLY for buttons?
- [ ] Would a SoHo agency approve this?
EOF
```

---

## PHASE 4: CREATE REPLICA TEMPLATES

Create pixel-perfect replicas of current UI for each major view.

### Step 1: Extract TWIN tab

In Claude Code:
```
Extract the TWIN tab UI from the current codebase into a standalone HTML file 
at .superdesign/replica_html_template/twin.html

Requirements:
- Pixel-perfect replica of current state
- Include all CSS inline or in <style> tags
- No improvements — just capture what exists
- Include: stats section, patterns section, Your World, Key People
```

### Step 2: Extract MIRROR tab

```
Extract the MIRROR tab chat UI into .superdesign/replica_html_template/mirror.html

Requirements:
- Chat message bubbles
- Input area
- Any loading states
- Pixel-perfect current state
```

### Step 3: Extract NOTES tab

```
Extract the NOTES tab into .superdesign/replica_html_template/notes.html

Requirements:
- Note list view
- Note detail view
- Input/capture area
- Skeleton loading states
```

### Step 4: Extract WORK tab

```
Extract the WORK tab into .superdesign/replica_html_template/work.html

Requirements:
- All sub-tabs: PULSE, ACTIONS, MEETINGS, COMMITMENTS
- Current styling
- Any modals (Meeting Mode, Decision Mode)
```

---

## PHASE 5: SYSTEMATIC UI REFINEMENT

### 5.1 Refine TWIN Tab

```bash
# Create project
superdesign create-project \
  --title "TWIN Tab Refinement" \
  --html-file .superdesign/replica_html_template/twin.html \
  --set-project-prompt-file .superdesign/design-system.md \
  --json

# Note the draftId from output, then iterate:

# Pass 1: Spacing
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Increase breathing room between sections. Stats should feel like luxury counters in a boutique, not cramped metrics. Add 24px between major sections." \
  --mode branch \
  --json

# Pass 2: Typography
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Sharpen typography hierarchy. Section titles: 13px uppercase, letter-spacing 0.08em, color #6B6B6B. Content: 15px, color #1A1A1A. Numbers: 32px semibold." \
  --mode branch \
  --json

# Pass 3: Cards
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Refine pattern cards. Reduce border to 1px solid rgba(0,0,0,0.06). Add subtle hover: border-color rgba(0,0,0,0.12). No background color changes." \
  --mode branch \
  --json
```

### 5.2 Refine MIRROR Tab

```bash
superdesign create-project \
  --title "MIRROR Tab Refinement" \
  --html-file .superdesign/replica_html_template/mirror.html \
  --set-project-prompt-file .superdesign/design-system.md \
  --json

# Pass 1: Message bubbles
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Refine chat bubbles. User messages: white background, right-aligned. AI messages: #FAFAFA background, left-aligned. Max-width 80%. Rounded corners 16px." \
  --mode branch \
  --json

# Pass 2: Input area
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Elevate input area. Clean border, generous padding (16px). Send button: black, minimal, icon only. Feels like texting a sophisticated friend." \
  --mode branch \
  --json
```

### 5.3 Refine NOTES Tab

```bash
superdesign create-project \
  --title "NOTES Tab Refinement" \
  --html-file .superdesign/replica_html_template/notes.html \
  --set-project-prompt-file .superdesign/design-system.md \
  --json

# Pass 1: Note cards
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Refine note cards. Cleaner separation. Date: 11px, uppercase, #6B6B6B. Preview text: 15px, 2 lines max, ellipsis. Reflection peek: italic, Cormorant Garamond." \
  --mode branch \
  --json

# Pass 2: Empty states
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Elevate empty state. Center vertically. Message in Cormorant Garamond italic. Subtle, inviting, not desperate." \
  --mode branch \
  --json
```

### 5.4 Refine WORK Tab

```bash
superdesign create-project \
  --title "WORK Tab Refinement" \
  --html-file .superdesign/replica_html_template/work.html \
  --set-project-prompt-file .superdesign/design-system.md \
  --json

# Pass 1: Sub-tab navigation
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Refine sub-tabs. Active: black text, subtle underline (2px). Inactive: #6B6B6B. Spacing: 24px between tabs. No background changes on active." \
  --mode branch \
  --json

# Pass 2: PULSE section
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Elevate Morning Pulse. Greeting: 24px, warm but not cheesy. Sections: clear visual hierarchy. Feels like a personalized magazine morning briefing." \
  --mode branch \
  --json

# Pass 3: Meeting cards
superdesign iterate-design-draft \
  --draft-id <draftId> \
  -p "Refine meeting cards. Date prominent but subtle. Attendees: small pills, #F5F5F5 background. Content preview: 2 lines max." \
  --mode branch \
  --json
```

---

## PHASE 6: APPLY REFINEMENTS TO CODEBASE

After reviewing SuperDesign outputs:

### Step 1: Review preview URLs

Each `iterate-design-draft` command returns a preview URL. Review each one.

### Step 2: Export approved changes

For each approved refinement:
```bash
superdesign export-design --draft-id <draftId> --output ./refined-components/
```

### Step 3: Apply to actual codebase

In Claude Code:
```
Apply the refined CSS from ./refined-components/twin.css to css/styles.css

Rules:
- Update existing selectors, don't duplicate
- Preserve all functionality
- Only change visual properties
- Commit with message "T2: Apply SuperDesign refinements to TWIN tab"
```

Repeat for each tab.

---

## PHASE 7: QUALITY ASSURANCE

### Visual Regression Check

After applying refinements:

```bash
# Verify no black backgrounds except buttons
grep -rn "background.*#000\|background.*black\|background-color.*#000" css/styles.css | grep -v "button\|btn"

# Verify no forbidden colors
grep -rn "background.*blue\|background.*red\|background.*green" css/styles.css
```

### Manual Check

Open https://digital-twin-ecru.vercel.app and verify:

| Check | Status |
|-------|--------|
| No black backgrounds (except buttons) | |
| Confident white space throughout | |
| Typography hierarchy clear | |
| Cards have subtle borders only | |
| Toasts are white with subtle border | |
| Loading states use skeletons | |
| Touch targets ≥44px on mobile | |

---

## QUICK REFERENCE COMMANDS

```bash
# Create new project
superdesign create-project --title "X" --html-file path.html --set-project-prompt-file .superdesign/design-system.md --json

# Iterate on design
superdesign iterate-design-draft --draft-id <id> -p "prompt" --mode branch --json

# Export
superdesign export-design --draft-id <id> --output ./path/

# List projects
superdesign list-projects --json

# Get draft
superdesign get-design-draft --draft-id <id> --json
```

---

## CONSTRAINTS REMINDER

Every refinement must follow:

✅ **ALLOWED:**
- More white space
- Sharper typography
- Subtler borders
- Cleaner alignment
- Refined interactions

❌ **FORBIDDEN:**
- Black backgrounds (except buttons)
- New colors
- Decorative elements
- Heavier shadows
- Longer animations
- Layout restructuring

The goal: Make it feel like a fashion magazine editorial — confident, minimal, sophisticated.

---

## DELIVERABLES

After completing this process:

1. ✅ Knowledge Pulse black popup fixed
2. ✅ SuperDesign installed and configured
3. ✅ Design system documented
4. ✅ Replica templates created for all tabs
5. ✅ Each tab refined through SuperDesign
6. ✅ Refinements applied to codebase
7. ✅ Quality assurance passed

Commit all changes:
```bash
git add -A
git commit -m "refactor: Apply SuperDesign refinements - SoHo minimalist editorial aesthetic"
git push origin main
```
