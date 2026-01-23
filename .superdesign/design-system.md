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
