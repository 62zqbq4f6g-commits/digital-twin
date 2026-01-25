/**
 * Attendee Auto-Suggest Component
 * Phase 16: TASK-013 - Auto-suggest dropdown for attendees field
 *
 * Features:
 * - Suggests known entities from user's world
 * - Debounced search (300ms)
 * - Keyboard navigation (arrows, enter, escape)
 * - Click to select
 * - Multiple attendees (comma-separated)
 */

class AttendeeSuggest {
  /**
   * @param {HTMLInputElement} input - The attendees input field
   * @param {Object} options - Configuration options
   * @param {Function} options.onSelect - Callback when entity is selected
   * @param {Function} options.getEntities - Function to get entities (defaults to Entities.entities)
   */
  constructor(input, options = {}) {
    this.input = input;
    this.onSelect = options.onSelect || (() => {});
    this.getEntities = options.getEntities || (() => window.Entities?.entities || null);

    this.dropdown = null;
    this.suggestions = [];
    this.selectedIndex = -1;
    this.debounceTimer = null;
    this.isOpen = false;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    if (!this.input) {
      console.error('[AttendeeSuggest] No input provided');
      return;
    }

    // Ensure parent has relative positioning for dropdown
    const parent = this.input.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    this.createDropdown();
    this.attachListeners();

    console.log('[AttendeeSuggest] Initialized');
  }

  /**
   * Create the dropdown element
   */
  createDropdown() {
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'attendee-dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.setAttribute('aria-label', 'Suggested attendees');
    this.dropdown.style.display = 'none';
    this.input.parentElement.appendChild(this.dropdown);

    // Set ARIA attributes on input
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.setAttribute('aria-haspopup', 'listbox');
  }

  /**
   * Attach event listeners
   */
  attachListeners() {
    // Input events
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onKeydown(e));
    this.input.addEventListener('blur', () => this.onBlur());
    this.input.addEventListener('focus', () => this.onFocus());

    // Dropdown mouse events
    this.dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur on input
      const item = e.target.closest('.attendee-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this.selectItem(index);
      }
    });
  }

  /**
   * Handle input event
   */
  onInput() {
    clearTimeout(this.debounceTimer);

    const query = this.getCurrentQuery();
    if (query.length < 2) {
      this.hideDropdown();
      return;
    }

    // Debounce search by 300ms
    this.debounceTimer = setTimeout(() => this.search(query), 300);
  }

  /**
   * Get the current query (text after last comma)
   * @returns {string}
   */
  getCurrentQuery() {
    const value = this.input.value;
    const lastComma = value.lastIndexOf(',');
    return value.slice(lastComma + 1).trim();
  }

  /**
   * Search entities by query
   * @param {string} query
   */
  search(query) {
    const entities = this.getEntities();
    if (!entities) {
      this.suggestions = [];
      this.hideDropdown();
      return;
    }

    const queryLower = query.toLowerCase();

    // Collect all entities with matching names
    const allEntities = [
      ...(entities.people || []).map(e => ({ ...e, type: 'person' })),
      ...(entities.projects || []).map(e => ({ ...e, type: 'project' })),
      ...(entities.places || []).map(e => ({ ...e, type: 'place' })),
      ...(entities.pets || []).map(e => ({ ...e, type: 'pet' })),
      ...(entities.other || []).map(e => ({ ...e, type: 'other' }))
    ];

    // Filter by query
    let matches = allEntities.filter(entity =>
      entity.name && entity.name.toLowerCase().includes(queryLower)
    );

    // Sort: Key People first, then by mention count
    matches.sort((a, b) => {
      // Key people (high importance) first
      const aIsKey = a.importance === 'high' || a.is_key_person;
      const bIsKey = b.importance === 'high' || b.is_key_person;
      if (aIsKey && !bIsKey) return -1;
      if (!aIsKey && bIsKey) return 1;

      // Then by mention count
      return (b.mention_count || 0) - (a.mention_count || 0);
    });

    // Limit to 5 suggestions
    this.suggestions = matches.slice(0, 5);

    // Filter out already-entered attendees
    const existingNames = this.getExistingAttendees();
    this.suggestions = this.suggestions.filter(
      entity => !existingNames.includes(entity.name.toLowerCase())
    );

    this.selectedIndex = -1;
    this.renderDropdown();
  }

  /**
   * Get list of already-entered attendee names
   * @returns {string[]}
   */
  getExistingAttendees() {
    const value = this.input.value;
    const lastComma = value.lastIndexOf(',');
    if (lastComma < 0) return [];

    return value
      .slice(0, lastComma)
      .split(',')
      .map(name => name.trim().toLowerCase())
      .filter(name => name.length > 0);
  }

  /**
   * Render the dropdown with suggestions
   */
  renderDropdown() {
    if (!this.suggestions.length) {
      this.hideDropdown();
      return;
    }

    this.dropdown.innerHTML = this.suggestions
      .map((entity, i) => {
        const typeLabel = this.getTypeLabel(entity);
        const relationLabel = entity.relationship ? ` - ${entity.relationship}` : '';
        return `
          <div class="attendee-item ${i === this.selectedIndex ? 'selected' : ''}"
               data-index="${i}"
               role="option"
               aria-selected="${i === this.selectedIndex}">
            <span class="attendee-name">${this.escapeHtml(entity.name)}</span>
            <span class="attendee-type">${typeLabel}${relationLabel}</span>
          </div>
        `;
      })
      .join('');

    this.showDropdown();
  }

  /**
   * Get display label for entity type
   * @param {Object} entity
   * @returns {string}
   */
  getTypeLabel(entity) {
    if (entity.importance === 'high' || entity.is_key_person) {
      return 'Key Person';
    }
    const typeMap = {
      person: 'Person',
      project: 'Project',
      place: 'Place',
      pet: 'Pet',
      other: ''
    };
    return typeMap[entity.type] || '';
  }

  /**
   * Show the dropdown
   */
  showDropdown() {
    this.dropdown.style.display = 'block';
    this.isOpen = true;
    this.input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Hide the dropdown
   */
  hideDropdown() {
    this.dropdown.style.display = 'none';
    this.isOpen = false;
    this.selectedIndex = -1;
    this.input.setAttribute('aria-expanded', 'false');
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} e
   */
  onKeydown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.suggestions.length - 1
        );
        this.renderDropdown();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderDropdown();
        break;

      case 'Enter':
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectItem(this.selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // Prevent modal from closing
        this.hideDropdown();
        break;

      case 'Tab':
        this.hideDropdown();
        break;
    }
  }

  /**
   * Handle blur event
   */
  onBlur() {
    // Delay to allow click on dropdown item
    setTimeout(() => this.hideDropdown(), 150);
  }

  /**
   * Handle focus event
   */
  onFocus() {
    const query = this.getCurrentQuery();
    if (query.length >= 2) {
      this.search(query);
    }
  }

  /**
   * Select an item from suggestions
   * @param {number} index
   */
  selectItem(index) {
    const entity = this.suggestions[index];
    if (!entity) return;

    // Replace current query with selected name
    const value = this.input.value;
    const lastComma = value.lastIndexOf(',');
    const prefix = lastComma >= 0 ? value.slice(0, lastComma + 1) + ' ' : '';
    this.input.value = prefix + entity.name;

    // Trigger input event to update any listeners
    this.input.dispatchEvent(new Event('input', { bubbles: true }));

    this.hideDropdown();
    this.onSelect(entity);
    this.input.focus();

    console.log('[AttendeeSuggest] Selected:', entity.name);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Destroy the component
   */
  destroy() {
    clearTimeout(this.debounceTimer);
    if (this.dropdown && this.dropdown.parentElement) {
      this.dropdown.remove();
    }
    console.log('[AttendeeSuggest] Destroyed');
  }
}

// Make globally available
window.AttendeeSuggest = AttendeeSuggest;
