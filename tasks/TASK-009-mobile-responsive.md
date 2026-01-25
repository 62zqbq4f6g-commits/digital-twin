# TASK-009: Mobile Responsive

## Overview
Ensure all enhancement UI components work properly on mobile devices.

## Priority
P0 — Week 2, Day 3-4

## Dependencies
- TASK-001 (Meeting capture UI)
- TASK-004 (Enhance display)
- TASK-005 (Loading states)

## Outputs
- CSS modifications to enhancement components

## Acceptance Criteria

### Layout (375px width)
- [ ] Full width layout, no horizontal scroll
- [ ] Proper padding (16px on mobile vs 24px on desktop)
- [ ] Textarea fills available width
- [ ] Buttons stack vertically on mobile

### Touch Targets
- [ ] All buttons ≥ 44px × 44px
- [ ] Voice button easily tappable
- [ ] Adequate spacing between interactive elements

### Input
- [ ] Font size ≥ 16px to prevent iOS zoom
- [ ] Keyboard doesn't obscure input
- [ ] Can scroll while keyboard is open

### Display
- [ ] Enhanced output readable on mobile
- [ ] Inscript Context section adapts
- [ ] No text truncation

## CSS Specs

```css
@media (max-width: 640px) {
  .meeting-capture,
  .enhanced-output {
    padding: 16px;
  }
  
  .meeting-title-input {
    font-size: 16px; /* Prevent iOS zoom */
  }
  
  .meeting-content-textarea {
    min-height: 160px;
    font-size: 16px; /* Prevent iOS zoom */
  }
  
  .voice-button {
    width: 48px;
    height: 48px;
  }
  
  .enhanced-actions {
    flex-direction: column;
  }
  
  .btn-ghost,
  .btn-primary {
    width: 100%;
  }
  
  .inscript-context {
    padding: 16px;
  }
  
  .enhanced-section-header {
    font-size: 10px;
  }
}

/* Ensure touch targets */
@media (pointer: coarse) {
  button, 
  [role="button"],
  input[type="submit"] {
    min-height: 44px;
    min-width: 44px;
  }
}
```

## Test Checklist

### iPhone Safari (375px)
- [ ] No horizontal scroll
- [ ] Textarea doesn't zoom on focus
- [ ] Voice button tappable
- [ ] Enhance button full width
- [ ] Keyboard doesn't break layout
- [ ] Can scroll enhanced output

### Android Chrome (360px)
- [ ] Same as iPhone tests
- [ ] Back button doesn't break state

### iPad (768px)
- [ ] Layout adapts appropriately
- [ ] Not too much whitespace
- [ ] Touch targets adequate

## Testing Tools

```bash
# Chrome DevTools device emulation
# Test at these widths:
# - 320px (iPhone SE)
# - 375px (iPhone 12)
# - 390px (iPhone 14)
# - 360px (Android)
# - 768px (iPad)
```
