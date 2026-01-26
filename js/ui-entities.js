/**
 * Inscript - Entity Editor UI Module
 * Handles entity editing, creation, and deletion modals
 * Extracted from ui.js for modularity (Phase 10.9)
 */

const EntityUI = {
  /**
   * Open entity editor modal
   * @param {string} entityId - Entity UUID
   */
  async openEditor(entityId) {
    if (typeof EntityMemory === 'undefined') {
      console.error('[EntityUI] EntityMemory not available');
      return;
    }

    const entity = await EntityMemory.getEntity(entityId);
    if (!entity) {
      UI.showToast('Entity not found');
      return;
    }

    // Remove existing modal
    this.closeEditor();

    const modal = document.createElement('div');
    modal.id = 'entity-editor-modal';
    modal.className = 'modal entity-editor-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="EntityUI.closeEditor()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Entity</h3>
          <button class="close-btn" onclick="EntityUI.closeEditor()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Name</label>
            <input type="text" id="entity-name" value="${this.escapeHtml(entity.name || '')}">
          </div>
          <div class="field">
            <label>Type</label>
            <select id="entity-type">
              <option value="person" ${entity.type === 'person' ? 'selected' : ''}>Person</option>
              <option value="pet" ${entity.type === 'pet' ? 'selected' : ''}>Pet</option>
              <option value="place" ${entity.type === 'place' ? 'selected' : ''}>Place</option>
              <option value="project" ${entity.type === 'project' ? 'selected' : ''}>Project</option>
              <option value="company" ${entity.type === 'company' ? 'selected' : ''}>Company</option>
              <option value="other" ${entity.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="field">
            <label>Relationship to You</label>
            <input type="text" id="entity-relationship"
              value="${this.escapeHtml(entity.relationship_to_user || '')}"
              placeholder="e.g., my co-founder, my dog, client">
          </div>
          <div class="field">
            <label>Details</label>
            <textarea id="entity-details" placeholder="Any other details...">${this.escapeHtml(entity.details || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-danger" onclick="EntityUI.delete('${entityId}')">Delete</button>
          <button class="btn-secondary" onclick="EntityUI.closeEditor()">Cancel</button>
          <button class="btn-primary" onclick="EntityUI.save('${entityId}')">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Focus name input
    setTimeout(() => {
      document.getElementById('entity-name')?.focus();
    }, 100);
  },

  /**
   * Save entity changes
   * @param {string} entityId - Entity UUID
   */
  async save(entityId) {
    const updates = {
      name: document.getElementById('entity-name')?.value || '',
      type: document.getElementById('entity-type')?.value || 'person',
      relationship_to_user: document.getElementById('entity-relationship')?.value || '',
      details: document.getElementById('entity-details')?.value || ''
    };

    if (!updates.name.trim()) {
      UI.showToast('Name is required');
      return;
    }

    const result = await EntityMemory.updateEntity(entityId, updates);

    if (result) {
      UI.showToast('Entity updated');
      this.closeEditor();
      // Refresh current note if displayed
      if (UI.currentNote) {
        await UI.refreshNoteDetail(UI.currentNote.id);
      }
    } else {
      UI.showToast('Couldn\'t update — try again');
    }
  },

  /**
   * Delete an entity
   * @param {string} entityId - Entity UUID
   */
  async delete(entityId) {
    const confirmed = await UI.confirm('Delete this entity? This cannot be undone.', {
      title: 'Delete Entity',
      confirmText: 'Delete',
      cancelText: 'Keep',
      danger: true
    });

    if (!confirmed) return;

    await EntityMemory.deleteEntity(entityId);
    UI.showToast('Entity deleted');
    this.closeEditor();

    // Refresh current note if displayed
    if (UI.currentNote) {
      await UI.refreshNoteDetail(UI.currentNote.id);
    }
  },

  /**
   * Close entity editor modal
   */
  closeEditor() {
    const modal = document.getElementById('entity-editor-modal');
    if (modal) modal.remove();
  },

  /**
   * Open entity editor by name - looks up entity and opens editor
   * @param {string} name - Entity name to search for
   * @param {string} type - Entity type hint
   */
  async openByName(name, type) {
    if (typeof EntityMemory === 'undefined') {
      UI.showToast('Entity system not available');
      return;
    }

    // Search for entity by name in loaded entities
    const entities = EntityMemory._entities || [];
    const entity = entities.find(e =>
      e.name && e.name.toLowerCase() === name.toLowerCase()
    );

    if (entity && entity.id) {
      await this.openEditor(entity.id);
    } else {
      // Entity not in memory - offer to create it
      this.showCreatePrompt(name, type);
    }
  },

  /**
   * Show prompt to create a new entity
   * @param {string} name - Suggested entity name
   * @param {string} type - Suggested entity type
   */
  showCreatePrompt(name, type) {
    const modal = document.createElement('div');
    modal.id = 'entity-create-modal';
    modal.className = 'modal entity-editor-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="EntityUI.closeCreateModal()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Entity</h3>
          <button class="close-btn" onclick="EntityUI.closeCreateModal()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--text-secondary);">
            "${this.escapeHtml(name)}" isn't saved yet. Would you like to add it?
          </p>
          <div class="field">
            <label>Name</label>
            <input type="text" id="new-entity-name" value="${this.escapeHtml(name)}">
          </div>
          <div class="field">
            <label>Type</label>
            <select id="new-entity-type">
              <option value="person" ${type === 'person' ? 'selected' : ''}>Person</option>
              <option value="pet" ${type === 'pet' ? 'selected' : ''}>Pet</option>
              <option value="place" ${type === 'place' ? 'selected' : ''}>Place</option>
              <option value="project" ${type === 'project' ? 'selected' : ''}>Project</option>
              <option value="company">Company</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label>Relationship to You</label>
            <input type="text" id="new-entity-relationship" placeholder="e.g., my co-founder, my dog">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="EntityUI.closeCreateModal()">Cancel</button>
          <button class="btn-primary" onclick="EntityUI.create()">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  /**
   * Create a new entity from the create modal
   */
  async create() {
    const name = document.getElementById('new-entity-name')?.value?.trim();
    const type = document.getElementById('new-entity-type')?.value || 'person';
    const relationship = document.getElementById('new-entity-relationship')?.value?.trim();

    if (!name) {
      UI.showToast('Name is required');
      return;
    }

    if (typeof EntityMemory !== 'undefined' && EntityMemory.createSingleEntity) {
      // Use the dedicated method for UI-created entities
      const success = await EntityMemory.createSingleEntity({
        name: name,
        type: type,
        relationship_to_user: relationship
      });

      if (success) {
        UI.showToast('Entity saved');
        this.closeCreateModal();
        // Refresh the note detail to show updated entity
        if (UI.currentNoteId) {
          await UI.showNoteDetail(UI.currentNoteId);
        }
      } else {
        UI.showToast('Couldn\'t save — try again');
      }
    } else {
      UI.showToast('Couldn\'t save — try again');
    }
  },

  /**
   * Close create entity modal
   */
  closeCreateModal() {
    const modal = document.getElementById('entity-create-modal');
    if (modal) modal.remove();
  },

  /**
   * Escape HTML for safe rendering
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for global access
window.EntityUI = EntityUI;
