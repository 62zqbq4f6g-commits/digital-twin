# TASK-013: Attendee Auto-Suggest

## Overview
Add auto-suggest dropdown for attendees field that suggests known entities.

## Priority
P1 — Week 3, Day 3-4

## Dependencies
- TASK-001 (Meeting capture UI with attendees field)
- Existing user_entities table

## Outputs
- `/js/attendee-suggest.js` — New file
- Modifications to meeting-capture.js

## Acceptance Criteria

### Functionality
- [ ] Typing in attendees field triggers search
- [ ] Dropdown shows matching entities
- [ ] Can select from dropdown or type custom name
- [ ] Multiple attendees supported (comma-separated)
- [ ] Shows entity type/relationship hint

### UX
- [ ] Dropdown appears after 2+ characters typed
- [ ] Debounced search (300ms)
- [ ] Keyboard navigation (arrow keys, enter, escape)
- [ ] Click to select
- [ ] Selected items show as pills/tags (optional, can be simple comma-separated)

### Data
- [ ] Searches user_entities by name
- [ ] Prioritizes Key People
- [ ] Shows recent entities first
- [ ] Max 5 suggestions

## Component Structure

```javascript
// js/attendee-suggest.js

export class AttendeeSuggest {
  constructor(input, options = {}) {
    this.input = input;
    this.userId = options.userId;
    this.onSelect = options.onSelect || (() => {});
    
    this.dropdown = null;
    this.suggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;
    
    this.createDropdown();
    this.attachListeners();
  }

  createDropdown() {
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'attendee-dropdown';
    this.dropdown.style.display = 'none';
    this.input.parentElement.appendChild(this.dropdown);
  }

  attachListeners() {
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onKeydown(e));
    this.input.addEventListener('blur', () => this.hideDropdown());
    
    this.dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      const item = e.target.closest('.attendee-item');
      if (item) this.selectItem(item.dataset.index);
    });
  }

  onInput() {
    clearTimeout(this.debounceTimer);
    
    const query = this.getCurrentQuery();
    if (query.length < 2) {
      this.hideDropdown();
      return;
    }

    this.debounceTimer = setTimeout(() => this.search(query), 300);
  }

  getCurrentQuery() {
    const value = this.input.value;
    const lastComma = value.lastIndexOf(',');
    return value.slice(lastComma + 1).trim();
  }

  async search(query) {
    try {
      const response = await fetch(
        `/api/entities/search?q=${encodeURIComponent(query)}&userId=${this.userId}&limit=5`
      );
      const data = await response.json();
      this.suggestions = data.entities || [];
      this.renderDropdown();
    } catch (error) {
      console.error('Search error:', error);
      this.hideDropdown();
    }
  }

  renderDropdown() {
    if (!this.suggestions.length) {
      this.hideDropdown();
      return;
    }

    this.dropdown.innerHTML = this.suggestions
      .map((entity, i) => `
        <div class="attendee-item ${i === this.selectedIndex ? 'selected' : ''}" 
             data-index="${i}">
          <span class="attendee-name">${entity.name}</span>
          ${entity.type ? `<span class="attendee-type">${entity.type}</span>` : ''}
        </div>
      `)
      .join('');

    this.dropdown.style.display = 'block';
  }

  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.selectedIndex = -1;
  }

  onKeydown(e) {
    if (this.dropdown.style.display === 'none') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
        this.renderDropdown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderDropdown();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectItem(this.selectedIndex);
        }
        break;
      case 'Escape':
        this.hideDropdown();
        break;
    }
  }

  selectItem(index) {
    const entity = this.suggestions[index];
    if (!entity) return;

    // Replace current query with selected name
    const value = this.input.value;
    const lastComma = value.lastIndexOf(',');
    const prefix = lastComma >= 0 ? value.slice(0, lastComma + 1) + ' ' : '';
    this.input.value = prefix + entity.name;

    this.hideDropdown();
    this.onSelect(entity);
    this.input.focus();
  }
}
```

## CSS Specs

```css
.attendee-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border: 1px solid #E5E5E5;
  border-top: none;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}

.attendee-item {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.attendee-item:hover,
.attendee-item.selected {
  background: #FAFAFA;
}

.attendee-name {
  font-size: 14px;
  color: #171717;
}

.attendee-type {
  font-size: 12px;
  color: #737373;
}
```

## Integration

```javascript
// In meeting-capture.js

import { AttendeeSuggest } from './attendee-suggest.js';

// After render
const attendeesInput = this.container.querySelector('.meeting-attendees-input');
this.attendeeSuggest = new AttendeeSuggest(attendeesInput, {
  userId: this.userId,
  onSelect: (entity) => {
    console.log('Selected entity:', entity);
  },
});
```

## Test Checklist

- [ ] Dropdown appears after 2 characters
- [ ] Shows matching entities
- [ ] Arrow keys navigate list
- [ ] Enter selects highlighted item
- [ ] Escape closes dropdown
- [ ] Click selects item
- [ ] Multiple attendees work (comma-separated)
- [ ] Custom names accepted (not just suggestions)
- [ ] Key People appear first
