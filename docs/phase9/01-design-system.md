# Phase 9: Design System

## Typography

### Font Stack
```css
/* Load in index.html */
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Playfair+Display:wght@500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

### Type Scale
```css
:root {
  /* Display — Section titles, hero text */
  --type-display: 600 2.5rem/1.1 'Playfair Display', Georgia, serif;
  
  /* Headlines */
  --type-h1: 500 1.75rem/1.2 'Playfair Display', Georgia, serif;
  --type-h2: 500 1.25rem/1.3 'Playfair Display', Georgia, serif;
  --type-h3: 500 1rem/1.4 'Inter', -apple-system, sans-serif;
  
  /* Body */
  --type-body: 400 0.9375rem/1.6 'Inter', -apple-system, sans-serif;
  --type-body-small: 400 0.8125rem/1.5 'Inter', -apple-system, sans-serif;
  
  /* UI */
  --type-label: 500 0.6875rem/1.4 'Inter', -apple-system, sans-serif;
  --type-caption: 400 0.75rem/1.4 'Inter', -apple-system, sans-serif;
  
  /* Mono */
  --type-mono: 400 0.8125rem/1.5 'JetBrains Mono', monospace;
}
```

### Typography Rules
- Labels: UPPERCASE, letter-spacing: 0.08em, muted color
- Headlines: Sentence case, never all caps
- Body: --ink-800, never pure black

---

## Colors

```css
:root {
  /* Ink — Text and UI */
  --ink-900: #0d0d0d;
  --ink-800: #1a1a1a;
  --ink-600: #4a4a4a;
  --ink-400: #8a8a8a;
  --ink-200: #c4c4c4;
  --ink-100: #e8e8e8;
  --ink-50: #f5f5f5;
  
  /* Paper — Backgrounds */
  --paper: #fafafa;
  --paper-warm: #faf9f7;
  --paper-pure: #ffffff;
  
  /* Semantic — Muted */
  --success: #2d5a3d;
  --warning: #8b6914;
  --error: #8b2d2d;
  
  /* Categories */
  --category-work: #d4c4a8;
  --category-personal: #c4d4d8;
  --category-ideas: #d8d4c4;
}
```

---

## Spacing

Base unit: 4px

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-8: 3rem;      /* 48px */
}
```

---

## Components

### Cards
```css
.card {
  background: var(--paper-pure);
  border-radius: 2px;
  padding: var(--space-5);
  border: 1px solid var(--ink-100);
  box-shadow: none;
}
```

### Primary Button
```css
.btn-primary {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--ink-900);
  color: var(--paper-pure);
  padding: var(--space-3) var(--space-5);
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### Secondary Button
```css
.btn-secondary {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: transparent;
  color: var(--ink-800);
  padding: var(--space-3) var(--space-5);
  border: 1px solid var(--ink-200);
  border-radius: 0;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: var(--ink-400);
}
```

### Text Button
```css
.btn-text {
  font: var(--type-body-small);
  color: var(--ink-600);
  background: none;
  border: none;
  padding: var(--space-2);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
```

### Form Input
```css
.input {
  font: var(--type-body);
  color: var(--ink-800);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ink-200);
  padding: var(--space-3) 0;
  width: 100%;
  border-radius: 0;
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-bottom-color: var(--ink-800);
}

.input::placeholder {
  color: var(--ink-400);
  font-style: italic;
}
```

### Label
```css
.label {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-400);
  display: block;
  margin-bottom: var(--space-2);
}
```

### Section Header
```css
.section-header {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-400);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--ink-100);
  margin-bottom: var(--space-4);
}
```

### Selection Pill
```css
.pill {
  font: var(--type-caption);
  color: var(--ink-600);
  background: var(--paper);
  border: 1px solid var(--ink-200);
  padding: var(--space-2) var(--space-3);
  border-radius: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover {
  border-color: var(--ink-400);
}

.pill--selected {
  background: var(--ink-900);
  color: var(--paper-pure);
  border-color: var(--ink-900);
}
```

### Radio Option Card
```css
.option-card {
  border: 1px solid var(--ink-200);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-card:hover {
  border-color: var(--ink-400);
}

.option-card--selected {
  background: var(--ink-900);
  border-color: var(--ink-900);
  color: var(--paper-pure);
}

.option-card__title {
  font: var(--type-body);
  font-weight: 500;
  margin-bottom: var(--space-1);
}

.option-card__subtitle {
  font: var(--type-caption);
  color: var(--ink-400);
}

.option-card--selected .option-card__subtitle {
  color: rgba(255,255,255,0.7);
}
```

### Stat Display
```css
.stat {
  text-align: center;
}

.stat__value {
  font: var(--type-h1);
  color: var(--ink-900);
  margin-bottom: var(--space-1);
}

.stat__label {
  font: var(--type-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-400);
}
```

---

## Animation

```css
:root {
  --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: fadeInUp var(--duration-slow) var(--ease-out) forwards;
}
```

---

## Icons

Use Lucide Icons (already in project) with:
```css
.icon {
  stroke-width: 1.5;
  width: 20px;
  height: 20px;
  color: var(--ink-600);
}
```
