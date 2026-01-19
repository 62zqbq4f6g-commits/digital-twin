# PHASE-8-INTELLIGENT-TWIN-SPEC.md
## Comprehensive Build Specification
### January 15, 2026

---

# Overview

**Build Name:** Intelligent Twin Package
**Version Target:** 5.1.0
**Estimated Effort:** 15-20 hours
**Complexity:** High

## Objective

Transform the Twin from a "smart note app" into an "intelligent personal agent" that:
1. Knows who the user is (self-awareness)
2. Can be corrected when wrong (learning from mistakes)
3. Understands relationships, not just names (contextual memory)
4. Shows what it has learned (visible intelligence)
5. Follows up on commitments (accountability)
6. Adapts nudges to what works (personalization)

## Success Criteria

After this build:
- User uploads selfie → Twin knows it's them, not "someone"
- User corrects "Seri is my dog" → Twin never forgets
- Output says "your co-founder Sarah" not just "Sarah"
- Twin tab shows "What I've Learned About You"
- Old actions trigger "Did you do it?" prompts
- Nudges adapt to user's response patterns

---

# Pre-Build Checklist

Before starting, verify:
- [ ] Chrome MCP connected (`/mcp` shows chrome-devtools connected)
- [ ] All tabs open: Digital Twin app, Supabase, GitHub, Vercel, Gemini
- [ ] Read CLAUDE.md, PRD.md, STATUS.md
- [ ] Brief Gemini on the build plan
- [ ] Current version confirmed (should be 5.0.40)

---

# Component 1: About Me Profile

## Purpose
Twin needs to know who the user IS to avoid treating selfies as "unknown person" and to personalize all interactions.

## Database Schema

```sql
-- User profile for self-awareness
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  display_name_encrypted TEXT,
  about_me_encrypted TEXT,
  self_descriptors JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);
```

### Schema Notes
- `display_name_encrypted`: User's name, encrypted with PIN
- `about_me_encrypted`: Free-form self-description, encrypted
- `self_descriptors`: Array of traits ["founder", "dog owner", "based in Singapore"]
- `preferences`: JSON for UI/behavior preferences

## Frontend Changes

### New File: js/user-profile.js

```javascript
window.UserProfile = {
  profile: null,
  
  async load() {
    // Load from Supabase, decrypt with PIN
    // Cache in memory
  },
  
  async save(updates) {
    // Encrypt with PIN
    // Save to Supabase
    // Update local cache
  },
  
  async getContextForAnalysis() {
    // Return formatted context for prompts
    // {
    //   userName: "Rox",
    //   aboutMe: "Founder building an AI app",
    //   descriptors: ["founder", "dog owner"]
    // }
  },
  
  isDescribingSelf(noteContent) {
    // Heuristics to detect self-reference
    // - Starts with "I am", "I'm", "I feel", "I look"
    // - Contains selfie + first-person language
    return Boolean;
  }
};
```

### UI Changes: js/twin-ui.js

Add "About Me" section at top of Twin tab:

```html
<div class="about-me-section">
  <h3>About You</h3>
  <div class="about-me-content">
    <div class="profile-field">
      <label>Your Name</label>
      <input type="text" id="profile-name" placeholder="What should I call you?">
    </div>
    <div class="profile-field">
      <label>About You</label>
      <textarea id="profile-about" placeholder="Tell me about yourself..."></textarea>
    </div>
    <div class="profile-field">
      <label>Quick Descriptors</label>
      <input type="text" id="profile-descriptors" placeholder="founder, dog owner, Singapore-based">
      <small>Comma-separated traits</small>
    </div>
    <button id="save-profile" class="btn-primary">Save</button>
  </div>
</div>
```

### CSS: css/styles.css

```css
.about-me-section {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.about-me-section h3 {
  margin: 0 0 16px 0;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.profile-field {
  margin-bottom: 16px;
}

.profile-field label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.profile-field input,
.profile-field textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  color: var(--text-primary);
  font-size: 14px;
}

.profile-field textarea {
  min-height: 80px;
  resize: vertical;
}

.profile-field small {
  font-size: 11px;
  color: var(--text-tertiary);
}
```

## Backend Changes

### api/analyze.js

Add user profile to prompt context:

```javascript
// In buildTaskSystemPrompt() and buildPersonalSystemPrompt()

function buildUserContext(userProfile) {
  if (!userProfile || !userProfile.userName) {
    return '';
  }
  
  return `
<user_profile>
  <name>${userProfile.userName}</name>
  <about>${userProfile.aboutMe || 'Not provided'}</about>
  <descriptors>${(userProfile.descriptors || []).join(', ')}</descriptors>
</user_profile>

IMPORTANT: This note is from ${userProfile.userName}. When they say "I" or "me", they mean themselves. If an image shows a person and the note uses first-person language, that person is likely ${userProfile.userName} - do NOT extract as "unknown person".
`;
}
```

### js/analyzer.js

Load and pass user profile:

```javascript
// In analyze() function

const userProfile = await UserProfile.getContextForAnalysis();

const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input,
    context: {
      ...fullContext,
      userProfile  // Add this
    },
    mode,
    noteType
  })
});
```

## Testing Checklist

- [ ] Create profile with name "TestUser"
- [ ] Create text note "I feel tired today"
- [ ] Verify output addresses "you" not "someone"
- [ ] Create image note with selfie + "I look tired"
- [ ] Verify no "unknown person" entity created
- [ ] Verify output says "You look tired" not "Someone looks tired"
- [ ] Clear app data, sign in again
- [ ] Verify profile loads from Supabase correctly

---

# Component 2: Entity Corrections UI

## Purpose
Users must be able to correct entity mistakes. This is critical for accuracy and trust.

## Database Changes

```sql
-- Add correction tracking to entities
ALTER TABLE entities ADD COLUMN IF NOT EXISTS relationship_to_user TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS user_corrected BOOLEAN DEFAULT FALSE;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS correction_history JSONB DEFAULT '[]';

-- Track corrections for learning
CREATE TABLE IF NOT EXISTS entity_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_id UUID REFERENCES entities(id),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE entity_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own corrections" ON entity_corrections
  FOR ALL USING (auth.uid() = user_id);
```

## Frontend Changes

### js/entity-memory.js

Add update and correction functions:

```javascript
window.EntityMemory = {
  // ... existing functions ...
  
  async updateEntity(entityId, updates) {
    // updates: { type, relationship_to_user, details, name }
    
    const entity = this.entities.find(e => e.id === entityId);
    if (!entity) return null;
    
    // Track what changed for learning
    const changes = [];
    for (const [key, value] of Object.entries(updates)) {
      if (entity[key] !== value) {
        changes.push({
          field: key,
          old: entity[key],
          new: value
        });
      }
    }
    
    // Update local
    Object.assign(entity, updates);
    entity.user_corrected = true;
    
    // Update Supabase
    const { error } = await supabase
      .from('entities')
      .update({
        ...updates,
        user_corrected: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId);
    
    if (error) {
      console.error('[EntityMemory] Update failed:', error);
      return null;
    }
    
    // Store corrections for learning
    await this.storeCorrections(entityId, changes);
    
    return entity;
  },
  
  async storeCorrections(entityId, changes) {
    const userId = await this.getUserId();
    if (!userId || changes.length === 0) return;
    
    const corrections = changes.map(c => ({
      user_id: userId,
      entity_id: entityId,
      field_changed: c.field,
      old_value: String(c.old || ''),
      new_value: String(c.new || '')
    }));
    
    await supabase.from('entity_corrections').insert(corrections);
  },
  
  async deleteEntity(entityId) {
    this.entities = this.entities.filter(e => e.id !== entityId);
    
    await supabase
      .from('entities')
      .delete()
      .eq('id', entityId);
  }
};
```

### js/ui.js

Add entity edit modal:

```javascript
// Add to renderNoteDetail() - make entities clickable

function renderEntities(entities, noteId) {
  if (!entities || entities.length === 0) return '';
  
  const entityChips = entities.map(e => `
    <span class="entity-chip" data-entity-id="${e.id}" onclick="UI.openEntityEditor('${e.id}')">
      ${e.name}
      <span class="entity-type">${e.type}</span>
    </span>
  `).join('');
  
  return `
    <div class="entities-section">
      <label>MENTIONED</label>
      <div class="entity-chips">${entityChips}</div>
    </div>
  `;
}

// Entity editor modal

window.UI = {
  // ... existing functions ...
  
  async openEntityEditor(entityId) {
    const entity = await EntityMemory.getEntity(entityId);
    if (!entity) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal entity-editor-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Entity</h3>
          <button class="close-btn" onclick="UI.closeEntityEditor()">×</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Name</label>
            <input type="text" id="entity-name" value="${entity.name || ''}">
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
              value="${entity.relationship_to_user || ''}"
              placeholder="e.g., my co-founder, my dog, client">
          </div>
          <div class="field">
            <label>Details</label>
            <textarea id="entity-details" placeholder="Any other details...">${entity.details || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-danger" onclick="UI.deleteEntity('${entityId}')">Delete</button>
          <button class="btn-secondary" onclick="UI.closeEntityEditor()">Cancel</button>
          <button class="btn-primary" onclick="UI.saveEntity('${entityId}')">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  },
  
  async saveEntity(entityId) {
    const updates = {
      name: document.getElementById('entity-name').value,
      type: document.getElementById('entity-type').value,
      relationship_to_user: document.getElementById('entity-relationship').value,
      details: document.getElementById('entity-details').value
    };
    
    await EntityMemory.updateEntity(entityId, updates);
    this.closeEntityEditor();
    
    // Show toast
    this.showToast('Entity updated! I\'ll remember this.');
    
    // Refresh note detail if open
    if (this.currentNoteId) {
      this.refreshNoteDetail(this.currentNoteId);
    }
  },
  
  async deleteEntity(entityId) {
    if (!confirm('Delete this entity? This cannot be undone.')) return;
    
    await EntityMemory.deleteEntity(entityId);
    this.closeEntityEditor();
    this.showToast('Entity deleted.');
  },
  
  closeEntityEditor() {
    const modal = document.querySelector('.entity-editor-modal');
    if (modal) modal.remove();
  }
};
```

### CSS additions

```css
.entity-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.entity-chip:hover {
  background: var(--surface-hover);
}

.entity-chip .entity-type {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.entity-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.entity-editor-modal .modal-content {
  background: var(--background);
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.entity-editor-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.entity-editor-modal .modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.entity-editor-modal .modal-body {
  padding: 16px;
}

.entity-editor-modal .field {
  margin-bottom: 16px;
}

.entity-editor-modal .field label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.entity-editor-modal .field input,
.entity-editor-modal .field select,
.entity-editor-modal .field textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
}

.entity-editor-modal .modal-footer {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border);
}

.entity-editor-modal .modal-footer .btn-danger {
  margin-right: auto;
}
```

## Testing Checklist

- [ ] Create note: "Meeting with Sarah"
- [ ] See Sarah appear as entity chip
- [ ] Tap Sarah → edit modal opens
- [ ] Change type to "person", add relationship "my co-founder"
- [ ] Save → toast appears
- [ ] Check Supabase entities table → updated correctly
- [ ] Check entity_corrections table → change logged
- [ ] Create new note: "Update Sarah on progress"
- [ ] Verify output says "your co-founder Sarah"
- [ ] Test delete entity flow

---

# Component 3: Relationship Context

## Purpose
Move beyond "Sarah is a person" to "Sarah is my co-founder who I meet weekly."

## Changes to Entity Extraction

### api/extract.js or api/analyze.js

Update extraction prompt:

```javascript
const extractionPrompt = `
Extract entities from this note. For each entity, identify:
1. Name
2. Type (person, pet, place, project, company, other)
3. Relationship to user (if mentioned or implied)
4. Any descriptive details

Examples:
- "Meeting with Sarah my co-founder" → {name: "Sarah", type: "person", relationship: "co-founder"}
- "Walking Seri in the park" → {name: "Seri", type: "pet or person (unclear)"} 
- "The Jakarta expansion is going well" → {name: "Jakarta expansion", type: "project"}

Note content:
${noteContent}

Return JSON array of entities.
`;
```

### js/entity-memory.js

Update getContextForAnalysis():

```javascript
getContextForAnalysis() {
  if (!this.entities || this.entities.length === 0) {
    return { knownEntities: [], summary: '' };
  }
  
  const knownEntities = this.entities.map(e => ({
    name: e.name,
    type: e.type,
    relationship: e.relationship_to_user || null,
    details: e.details || null,
    mentionCount: e.mention_count || 1,
    userCorrected: e.user_corrected || false
  }));
  
  // Build rich summary
  const people = knownEntities.filter(e => e.type === 'person');
  const pets = knownEntities.filter(e => e.type === 'pet');
  const places = knownEntities.filter(e => e.type === 'place');
  const projects = knownEntities.filter(e => e.type === 'project');
  
  const summaryParts = [];
  if (people.length > 0) {
    const peopleDesc = people.map(p => 
      p.relationship ? `${p.name} (${p.relationship})` : p.name
    ).join(', ');
    summaryParts.push(`People: ${peopleDesc}`);
  }
  if (pets.length > 0) {
    const petsDesc = pets.map(p => 
      `${p.name} (${p.details || 'pet'})`
    ).join(', ');
    summaryParts.push(`Pets: ${petsDesc}`);
  }
  if (projects.length > 0) {
    summaryParts.push(`Projects: ${projects.map(p => p.name).join(', ')}`);
  }
  
  return {
    knownEntities,
    summary: summaryParts.join('. ')
  };
}
```

### api/analyze.js

Update XML generation:

```javascript
function buildMemorySection(context) {
  const { knownEntities } = context;
  
  if (!knownEntities || knownEntities.length === 0) {
    return '';
  }
  
  const entityXML = knownEntities.map(e => {
    const attrs = [
      `name="${e.name}"`,
      `type="${e.type}"`
    ];
    if (e.relationship) attrs.push(`relationship="${e.relationship}"`);
    if (e.userCorrected) attrs.push(`verified="true"`);
    
    const description = e.relationship 
      ? `User's ${e.relationship} named ${e.name}`
      : `A ${e.type} the user knows`;
    
    return `  <entity ${attrs.join(' ')}>${description}</entity>`;
  }).join('\n');
  
  return `
<known_entities>
${entityXML}
</known_entities>

CRITICAL: When referencing entities, use relationship context:
- If relationship="co-founder", say "your co-founder Sarah" not just "Sarah"
- If type="pet", say "your dog Seri" not just "Seri"
- If verified="true", this was explicitly confirmed by user - always use this info
`;
}
```

## Testing Checklist

- [ ] Create note: "Call Sarah my co-founder"
- [ ] Verify entity extracted with relationship="co-founder"
- [ ] Create new note: "Prepare deck for Sarah"
- [ ] Verify output says "your co-founder Sarah"
- [ ] Manually edit entity, add relationship "CTO at TechCorp"
- [ ] Create note mentioning that entity
- [ ] Verify enriched context appears in output

---

# Component 4: Visible Learning Section

## Purpose
Show users what the Twin has learned. Critical for trust and demonstrating the flywheel.

## Frontend Changes

### js/twin-ui.js

Add new section:

```javascript
window.TwinUI = {
  // ... existing functions ...
  
  async renderLearningSection() {
    const container = document.getElementById('learning-section');
    if (!container) return;
    
    // Gather stats
    const entityStats = await this.getEntityStats();
    const feedbackStats = await this.getFeedbackStats();
    const preferences = await QualityLearning.getPreferencesContext();
    const actionStats = await this.getActionStats();
    
    container.innerHTML = `
      <div class="learning-section">
        <h3>🧠 What I've Learned About You</h3>
        
        <div class="learning-category">
          <h4>Your World</h4>
          <div class="learning-stats">
            <div class="stat">
              <span class="stat-value">${entityStats.people}</span>
              <span class="stat-label">People</span>
            </div>
            <div class="stat">
              <span class="stat-value">${entityStats.places}</span>
              <span class="stat-label">Places</span>
            </div>
            <div class="stat">
              <span class="stat-value">${entityStats.projects}</span>
              <span class="stat-label">Projects</span>
            </div>
          </div>
          ${entityStats.topMentioned ? `
            <p class="learning-insight">Most mentioned: <strong>${entityStats.topMentioned}</strong></p>
          ` : ''}
        </div>
        
        <div class="learning-category">
          <h4>Writing Preferences</h4>
          ${preferences.hasData ? `
            <ul class="preference-list">
              ${preferences.prefersConcise ? '<li>You prefer concise summaries</li>' : ''}
              ${preferences.dislikesEmotional ? '<li>You dislike emotional language</li>' : ''}
              ${preferences.prefersActionable ? '<li>You prefer actionable outputs</li>' : ''}
            </ul>
          ` : `
            <p class="learning-empty">Give feedback on outputs to help me learn your style</p>
          `}
        </div>
        
        <div class="learning-category">
          <h4>Your Patterns</h4>
          <div class="learning-stats">
            <div class="stat">
              <span class="stat-value">${feedbackStats.total}</span>
              <span class="stat-label">Feedback Given</span>
            </div>
            <div class="stat">
              <span class="stat-value">${actionStats.completionRate}%</span>
              <span class="stat-label">Action Completion</span>
            </div>
          </div>
          ${actionStats.bestNudge ? `
            <p class="learning-insight">You respond best to: <strong>${actionStats.bestNudge}</strong> nudges</p>
          ` : ''}
        </div>
        
        <div class="learning-footer">
          <p>I'm learning from your feedback to become more helpful</p>
        </div>
      </div>
    `;
  },
  
  async getEntityStats() {
    const entities = EntityMemory.entities || [];
    const people = entities.filter(e => e.type === 'person').length;
    const places = entities.filter(e => e.type === 'place').length;
    const projects = entities.filter(e => e.type === 'project').length;
    
    // Find most mentioned
    let topMentioned = null;
    let maxMentions = 0;
    entities.forEach(e => {
      if ((e.mention_count || 0) > maxMentions) {
        maxMentions = e.mention_count;
        topMentioned = e.name;
      }
    });
    
    return { people, places, projects, topMentioned };
  },
  
  async getFeedbackStats() {
    const userId = await this.getUserId();
    if (!userId) return { total: 0, positive: 0, negative: 0 };
    
    const { data } = await supabase
      .from('output_feedback')
      .select('rating')
      .eq('user_id', userId);
    
    const total = data?.length || 0;
    const positive = data?.filter(d => d.rating === 'liked').length || 0;
    const negative = data?.filter(d => d.rating === 'disliked').length || 0;
    
    return { total, positive, negative };
  },
  
  async getActionStats() {
    const userId = await this.getUserId();
    if (!userId) return { completionRate: 0, bestNudge: null };
    
    const { data } = await supabase
      .from('action_signals')
      .select('*')
      .eq('user_id', userId);
    
    if (!data || data.length === 0) {
      return { completionRate: 0, bestNudge: null };
    }
    
    const completed = data.filter(d => d.completed_at).length;
    const completionRate = Math.round((completed / data.length) * 100);
    
    // Find best nudge type
    const nudgeStats = {};
    data.forEach(d => {
      if (d.nudge_type && d.completed_at) {
        nudgeStats[d.nudge_type] = (nudgeStats[d.nudge_type] || 0) + 1;
      }
    });
    
    let bestNudge = null;
    let maxCompleted = 0;
    Object.entries(nudgeStats).forEach(([type, count]) => {
      if (count > maxCompleted) {
        maxCompleted = count;
        bestNudge = type;
      }
    });
    
    return { completionRate, bestNudge };
  }
};
```

### CSS additions

```css
.learning-section {
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  margin-top: 24px;
}

.learning-section h3 {
  margin: 0 0 20px 0;
  font-size: 16px;
}

.learning-category {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.learning-category:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.learning-category h4 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin: 0 0 12px 0;
}

.learning-stats {
  display: flex;
  gap: 24px;
}

.learning-stats .stat {
  text-align: center;
}

.learning-stats .stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.learning-stats .stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.learning-insight {
  margin: 12px 0 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.learning-insight strong {
  color: var(--text-primary);
}

.preference-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.preference-list li {
  margin-bottom: 4px;
}

.learning-empty {
  font-size: 13px;
  color: var(--text-tertiary);
  font-style: italic;
}

.learning-footer {
  text-align: center;
  padding-top: 16px;
}

.learning-footer p {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}
```

### HTML: index.html

Add container in Twin tab:

```html
<div id="twin-tab" class="tab-content">
  <!-- About Me section (Component 1) -->
  <div id="about-me-section"></div>
  
  <!-- Learning section (Component 4) -->
  <div id="learning-section"></div>
  
  <!-- Existing Twin content -->
  ...
</div>
```

## Testing Checklist

- [ ] Open Twin tab
- [ ] Verify "What I've Learned" section appears
- [ ] Check entity counts are accurate
- [ ] Give some feedback on notes
- [ ] Refresh Twin tab
- [ ] Verify feedback count updated
- [ ] Complete some actions
- [ ] Verify completion rate shown
- [ ] Test with empty data (new user)
- [ ] Verify graceful empty states

---

# Component 5: "Did You Do It?" Follow-up

## Purpose
Accountability loop. Follow up on old actions to drive completion.

## Database Changes

```sql
ALTER TABLE action_signals ADD COLUMN IF NOT EXISTS follow_up_shown_at TIMESTAMP;
ALTER TABLE action_signals ADD COLUMN IF NOT EXISTS follow_up_response TEXT;
-- follow_up_response: 'done', 'working', 'wont_do', null
```

## Frontend Changes

### js/follow-up.js (new file)

```javascript
window.FollowUp = {
  FOLLOW_UP_DELAY_HOURS: 24,
  
  async checkPendingFollowUps() {
    const pendingActions = await this.getPendingActions();
    const dueForFollowUp = pendingActions.filter(a => this.isDueForFollowUp(a));
    
    if (dueForFollowUp.length > 0) {
      this.showFollowUpPrompt(dueForFollowUp);
    }
    
    return dueForFollowUp.length;
  },
  
  async getPendingActions() {
    // Get all incomplete actions older than threshold
    const userId = await this.getUserId();
    if (!userId) return [];
    
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.FOLLOW_UP_DELAY_HOURS);
    
    const { data } = await supabase
      .from('action_signals')
      .select('*')
      .eq('user_id', userId)
      .is('completed_at', null)
      .lt('created_at', cutoff.toISOString())
      .is('follow_up_response', null);
    
    return data || [];
  },
  
  isDueForFollowUp(action) {
    if (action.follow_up_shown_at) {
      // Don't show again within 24 hours
      const lastShown = new Date(action.follow_up_shown_at);
      const hoursSince = (Date.now() - lastShown.getTime()) / (1000 * 60 * 60);
      return hoursSince >= this.FOLLOW_UP_DELAY_HOURS;
    }
    return true;
  },
  
  showFollowUpPrompt(actions) {
    const modal = document.createElement('div');
    modal.className = 'modal follow-up-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Quick check-in</h3>
        </div>
        <div class="modal-body">
          <p>You had ${actions.length} action${actions.length > 1 ? 's' : ''} pending:</p>
          <div class="follow-up-actions">
            ${actions.map(a => this.renderFollowUpAction(a)).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="FollowUp.dismissAll()">Ask me later</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Mark as shown
    actions.forEach(a => this.markFollowUpShown(a.id));
  },
  
  renderFollowUpAction(action) {
    return `
      <div class="follow-up-action" data-action-id="${action.action_id}">
        <p class="action-text">${action.action_text}</p>
        <div class="follow-up-buttons">
          <button class="btn-success" onclick="FollowUp.respond('${action.action_id}', 'done')">
            ✓ Done
          </button>
          <button class="btn-secondary" onclick="FollowUp.respond('${action.action_id}', 'working')">
            Still working
          </button>
          <button class="btn-ghost" onclick="FollowUp.respond('${action.action_id}', 'wont_do')">
            Won't do
          </button>
        </div>
      </div>
    `;
  },
  
  async respond(actionId, response) {
    const userId = await this.getUserId();
    
    const updates = {
      follow_up_response: response,
      updated_at: new Date().toISOString()
    };
    
    if (response === 'done') {
      updates.completed_at = new Date().toISOString();
    }
    
    await supabase
      .from('action_signals')
      .update(updates)
      .eq('action_id', actionId)
      .eq('user_id', userId);
    
    // Remove this action from modal
    const actionEl = document.querySelector(`[data-action-id="${actionId}"]`);
    if (actionEl) {
      actionEl.remove();
    }
    
    // Check if modal should close
    const remaining = document.querySelectorAll('.follow-up-action');
    if (remaining.length === 0) {
      this.closeModal();
      UI.showToast(response === 'done' ? '🎉 Nice work!' : 'Got it!');
    }
  },
  
  async markFollowUpShown(actionId) {
    await supabase
      .from('action_signals')
      .update({ follow_up_shown_at: new Date().toISOString() })
      .eq('action_id', actionId);
  },
  
  dismissAll() {
    this.closeModal();
  },
  
  closeModal() {
    const modal = document.querySelector('.follow-up-modal');
    if (modal) modal.remove();
  },
  
  async getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }
};
```

### js/app.js

Check for follow-ups on app load:

```javascript
// In init() or after auth

async function checkFollowUps() {
  const count = await FollowUp.checkPendingFollowUps();
  console.log(`[App] ${count} actions due for follow-up`);
}

// Call after app initializes
setTimeout(checkFollowUps, 2000); // Delay to not interrupt initial load
```

### CSS additions

```css
.follow-up-modal .modal-content {
  max-width: 400px;
}

.follow-up-actions {
  margin-top: 16px;
}

.follow-up-action {
  background: var(--surface);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.follow-up-action .action-text {
  margin: 0 0 12px 0;
  font-size: 14px;
}

.follow-up-buttons {
  display: flex;
  gap: 8px;
}

.follow-up-buttons button {
  flex: 1;
  padding: 8px;
  font-size: 12px;
}

.btn-success {
  background: var(--success);
  color: white;
  border: none;
  border-radius: 6px;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
}
```

## Testing Checklist

- [ ] Create note with action
- [ ] Manually update action_signals.created_at to 25 hours ago (via Supabase)
- [ ] Refresh app
- [ ] Verify follow-up prompt appears
- [ ] Click "Done" → verify action marked complete
- [ ] Test "Still working" → verify no completed_at
- [ ] Test "Won't do" → verify follow_up_response set
- [ ] Test "Ask me later" → verify modal closes
- [ ] Verify follow-up doesn't show again within 24 hours

---

# Component 6: Nudge Effectiveness Tracking

## Purpose
Learn which nudge types work for this user and show more of those.

## Database Changes

```sql
CREATE TABLE IF NOT EXISTS nudge_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  nudge_type TEXT NOT NULL,
  shown_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  effectiveness_score FLOAT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, nudge_type)
);

ALTER TABLE nudge_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nudge stats" ON nudge_effectiveness
  FOR ALL USING (auth.uid() = user_id);
```

## Frontend Changes

### js/nudge-tracker.js (new file)

```javascript
window.NudgeTracker = {
  NUDGE_TYPES: ['commitment', 'reminder', 'question', 'motivation', 'deadline'],
  
  async trackShown(nudgeType) {
    await this.incrementStat(nudgeType, 'shown_count');
  },
  
  async trackClicked(nudgeType) {
    await this.incrementStat(nudgeType, 'clicked_count');
  },
  
  async trackCompleted(nudgeType) {
    await this.incrementStat(nudgeType, 'completed_count');
    await this.recalculateScore(nudgeType);
  },
  
  async incrementStat(nudgeType, field) {
    const userId = await this.getUserId();
    if (!userId) return;
    
    // Upsert the record
    const { data: existing } = await supabase
      .from('nudge_effectiveness')
      .select('*')
      .eq('user_id', userId)
      .eq('nudge_type', nudgeType)
      .single();
    
    if (existing) {
      await supabase
        .from('nudge_effectiveness')
        .update({ 
          [field]: existing[field] + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('nudge_effectiveness')
        .insert({
          user_id: userId,
          nudge_type: nudgeType,
          [field]: 1
        });
    }
  },
  
  async recalculateScore(nudgeType) {
    const userId = await this.getUserId();
    if (!userId) return;
    
    const { data } = await supabase
      .from('nudge_effectiveness')
      .select('*')
      .eq('user_id', userId)
      .eq('nudge_type', nudgeType)
      .single();
    
    if (data && data.shown_count > 0) {
      const score = data.completed_count / data.shown_count;
      await supabase
        .from('nudge_effectiveness')
        .update({ effectiveness_score: score })
        .eq('id', data.id);
    }
  },
  
  async getBestNudgeType() {
    const userId = await this.getUserId();
    if (!userId) return null;
    
    const { data } = await supabase
      .from('nudge_effectiveness')
      .select('*')
      .eq('user_id', userId)
      .order('effectiveness_score', { ascending: false })
      .limit(1);
    
    return data?.[0]?.nudge_type || null;
  },
  
  async getNudgePreferences() {
    const userId = await this.getUserId();
    if (!userId) return {};
    
    const { data } = await supabase
      .from('nudge_effectiveness')
      .select('*')
      .eq('user_id', userId);
    
    if (!data || data.length === 0) return {};
    
    // Sort by effectiveness
    const sorted = data.sort((a, b) => b.effectiveness_score - a.effectiveness_score);
    
    return {
      best: sorted[0]?.nudge_type,
      worst: sorted[sorted.length - 1]?.nudge_type,
      stats: data.reduce((acc, d) => {
        acc[d.nudge_type] = {
          shown: d.shown_count,
          completed: d.completed_count,
          score: d.effectiveness_score
        };
        return acc;
      }, {})
    };
  },
  
  async getUserId() {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  }
};
```

### Integration with actions-ui.js

```javascript
// When rendering a nudge
function renderNudge(action) {
  const nudgeType = action.nudge_type || 'reminder';
  
  // Track that nudge was shown
  NudgeTracker.trackShown(nudgeType);
  
  // ... render nudge UI
}

// When user clicks/interacts with nudge
function onNudgeClick(actionId, nudgeType) {
  NudgeTracker.trackClicked(nudgeType);
  // ... existing click handling
}

// When action is completed
function onActionComplete(actionId, nudgeType) {
  NudgeTracker.trackCompleted(nudgeType);
  // ... existing completion handling
}
```

### Integration with analyzer.js

```javascript
// When building context for API
async function buildFullContext() {
  // ... existing context building
  
  const nudgePrefs = await NudgeTracker.getNudgePreferences();
  
  return {
    ...existingContext,
    nudgePreferences: nudgePrefs
  };
}
```

### Integration with api/analyze.js

```javascript
// In action generation
function buildNudgeInstruction(nudgePreferences) {
  if (!nudgePreferences || !nudgePreferences.best) {
    return '';
  }
  
  return `
<nudge_preferences>
  <preferred_type>${nudgePreferences.best}</preferred_type>
  <avoid_type>${nudgePreferences.worst || 'none'}</avoid_type>
</nudge_preferences>

When generating nudges for actions, prefer "${nudgePreferences.best}" style nudges as this user responds well to them.
`;
}
```

## Testing Checklist

- [ ] Create note with action
- [ ] Verify nudge_effectiveness row created
- [ ] Complete the action
- [ ] Verify completed_count incremented
- [ ] Verify effectiveness_score calculated
- [ ] Create multiple actions with different nudges
- [ ] Complete some, ignore others
- [ ] Verify best nudge type identified
- [ ] Create new note
- [ ] Verify preferred nudge type appears in output

---

# Deployment & Testing

## Pre-Deployment Checklist

- [ ] All 6 components implemented
- [ ] Version bumped to 5.1.0 in sw.js
- [ ] All new files added to index.html (scripts)
- [ ] CSS additions merged into styles.css
- [ ] No console errors locally
- [ ] Gemini briefed on all components

## Deployment Steps

```bash
# 1. Commit all changes
git add .
git commit -m "feat: Intelligent Twin Package v5.1.0

- About Me profile (self-awareness)
- Entity corrections UI
- Relationship context
- Visible learning section
- Did you do it follow-up loop
- Nudge effectiveness tracking"

# 2. Deploy
vercel --prod

# 3. Verify deployment
curl -I https://digital-twin-ecru.vercel.app
```

## Post-Deployment Testing

Run full test suite in Chrome via MCP:

1. **About Me Profile**
   - Set up profile
   - Test selfie recognition
   
2. **Entity Corrections**
   - Create entity
   - Edit entity
   - Delete entity
   
3. **Relationship Context**
   - Add relationship
   - Verify in output
   
4. **Visible Learning**
   - Check stats accuracy
   - Verify updates after actions
   
5. **Follow-up Loop**
   - Simulate old action
   - Test all response types
   
6. **Nudge Effectiveness**
   - Track shown/completed
   - Verify best nudge surfaces

## Rollback Plan

If critical issues found:

```bash
# Rollback to previous deployment
vercel rollback
```

---

# Success Metrics

After this build:

| Metric | Before | Target |
|--------|--------|--------|
| Self-awareness | 0% | 100% (knows user's name) |
| Entity accuracy | ~80% | 95%+ (corrections enabled) |
| Visible learning | 0 signals shown | All key stats visible |
| Follow-up rate | 0% | 50%+ actions get follow-up |
| Nudge personalization | None | Top 2 nudge types identified |

---

# Files Changed Summary

| File | Change Type |
|------|-------------|
| `js/user-profile.js` | New |
| `js/follow-up.js` | New |
| `js/nudge-tracker.js` | New |
| `js/entity-memory.js` | Modified |
| `js/ui.js` | Modified |
| `js/twin-ui.js` | Modified |
| `js/analyzer.js` | Modified |
| `js/actions-ui.js` | Modified |
| `js/app.js` | Modified |
| `api/analyze.js` | Modified |
| `css/styles.css` | Modified |
| `index.html` | Modified |
| `sw.js` | Modified (version) |

---

*Specification created: January 15, 2026*
*Target version: 5.1.0*
*Estimated completion: 1-2 days*
