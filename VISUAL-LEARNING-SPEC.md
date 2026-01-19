# VISUAL-LEARNING-SPEC.md
## Image-Based Entity Training
### January 15, 2026

---

# Overview

**Feature:** Visual Learning — Store image descriptions with entities
**Version Target:** 5.1.3
**Estimated Effort:** 2-3 hours
**Priority:** High — Quick win, high impact

## Objective

When a photo is uploaded, extract visual descriptions and store them with entities. This allows the Twin to "remember" what people, pets, and places look like.

## Current State

```
Photo uploaded → Claude Vision describes → Analysis generated → Done
                                                    ↓
                                         (visual data discarded)
```

## Target State

```
Photo uploaded → Claude Vision describes → Extract visual entities
                                                    ↓
                                         Store: "Seri: golden fur, red collar"
                                                    ↓
                                         Future note about Seri → 
                                         "your golden retriever Seri"
```

---

# Implementation

## 1. API Changes: api/analyze.js

### 1.1 Update Image Analysis Prompt

When a note contains an image, add this to the system prompt:

```javascript
const visualEntityInstruction = `
If this note contains an image with visible people, pets, or identifiable places/objects, extract visual descriptions.

Return visual descriptions in this XML format at the end of your response:

<visual_entities>
  <entity name="[Name]" type="[person|pet|place|object]" visual="[Brief visual description]"/>
</visual_entities>

Examples:
<visual_entities>
  <entity name="Seri" type="pet" visual="Golden retriever with fluffy fur, wearing a red collar"/>
  <entity name="Sarah" type="person" visual="Woman with shoulder-length dark hair, wearing glasses"/>
  <entity name="Home Office" type="place" visual="Desk with dual monitors, plants on windowsill"/>
</visual_entities>

Only include entities that are clearly visible in the image. Keep descriptions concise (under 20 words each).
`;
```

### 1.2 Add Visual Instruction to Prompt Building

In `buildTaskSystemPrompt()` and `buildPersonalSystemPrompt()`:

```javascript
function buildSystemPrompt(context, noteType) {
  let prompt = basePrompt;
  
  // Add memory context
  if (context.memoryContext) {
    prompt += buildMemorySection(context.memoryContext);
  }
  
  // Add user profile context
  if (context.userProfile) {
    prompt += buildUserProfileSection(context.userProfile);
  }
  
  // Add visual entity extraction if image present
  if (context.hasImage) {
    prompt += visualEntityInstruction;
  }
  
  return prompt;
}
```

### 1.3 Parse Visual Entities from Response

Add a new function to extract visual entities:

```javascript
function parseVisualEntities(responseText) {
  const visualEntities = [];
  
  // Match <visual_entities> block
  const visualMatch = responseText.match(/<visual_entities>([\s\S]*?)<\/visual_entities>/);
  
  if (!visualMatch) return visualEntities;
  
  // Match individual entities
  const entityRegex = /<entity\s+name="([^"]+)"\s+type="([^"]+)"\s+visual="([^"]+)"\/>/g;
  let match;
  
  while ((match = entityRegex.exec(visualMatch[1])) !== null) {
    visualEntities.push({
      name: match[1],
      type: match[2],
      visual: match[3]
    });
  }
  
  return visualEntities;
}
```

### 1.4 Return Visual Entities in API Response

Update the response to include parsed visual entities:

```javascript
// At the end of the handler
const visualEntities = parseVisualEntities(aiResponse);

return res.status(200).json({
  success: true,
  analysis: parsedAnalysis,
  visualEntities: visualEntities,  // Add this
  preferencesApplied: preferencesApplied
});
```

---

## 2. Frontend Changes: js/analyzer.js

### 2.1 Handle Visual Entities in Response

After receiving analysis response, process visual entities:

```javascript
async analyze(note, options = {}) {
  // ... existing code to call API ...
  
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: note.content,
      context: fullContext,
      hasImage: Boolean(note.image),  // Pass image flag
      // ... other fields
    })
  });
  
  const data = await response.json();
  
  // Process visual entities if present
  if (data.visualEntities && data.visualEntities.length > 0) {
    await this.storeVisualEntities(data.visualEntities);
  }
  
  return data.analysis;
}

async storeVisualEntities(visualEntities) {
  for (const ve of visualEntities) {
    await EntityMemory.storeEntityWithVisual({
      name: ve.name,
      type: ve.type
    }, ve.visual);
  }
  console.log(`[Analyzer] Stored ${visualEntities.length} visual entities`);
}
```

---

## 3. Entity Memory Changes: js/entity-memory.js

### 3.1 Add Visual Storage Function

```javascript
window.EntityMemory = {
  // ... existing code ...
  
  /**
   * Store or update an entity with visual description
   * @param {Object} entity - { name, type }
   * @param {string} visualDescription - Visual description from image
   */
  async storeEntityWithVisual(entity, visualDescription) {
    if (!visualDescription) {
      return this.storeEntities([entity]);
    }
    
    const userId = await this.getUserId();
    if (!userId) return;
    
    // Check if entity exists
    const existing = this.entities.find(
      e => e.name.toLowerCase() === entity.name.toLowerCase()
    );
    
    if (existing) {
      // Update existing entity with visual info
      await this.mergeVisualDescription(existing.id, visualDescription);
    } else {
      // Create new entity with visual
      await this.createEntityWithVisual(entity, visualDescription, userId);
    }
  },
  
  /**
   * Merge visual description into existing entity
   */
  async mergeVisualDescription(entityId, visualDescription) {
    const entity = this.entities.find(e => e.id === entityId);
    if (!entity) return;
    
    // Check if visual already exists
    const currentDetails = entity.details || '';
    if (currentDetails.includes(visualDescription)) {
      console.log(`[EntityMemory] Visual already stored for ${entity.name}`);
      return;
    }
    
    // Append visual description
    let newDetails;
    if (currentDetails.includes('Visual:')) {
      // Already has visual info, append new observation
      newDetails = `${currentDetails}; ${visualDescription}`;
    } else if (currentDetails) {
      // Has other details, add visual section
      newDetails = `${currentDetails}. Visual: ${visualDescription}`;
    } else {
      // No existing details
      newDetails = `Visual: ${visualDescription}`;
    }
    
    // Update in database
    await this.updateEntity(entityId, { details: newDetails });
    console.log(`[EntityMemory] Updated visual for ${entity.name}`);
  },
  
  /**
   * Create new entity with visual description
   */
  async createEntityWithVisual(entity, visualDescription, userId) {
    const details = `Visual: ${visualDescription}`;
    
    const encryptedName = await PIN.encrypt(entity.name);
    
    const { data, error } = await supabase
      .from('entities')
      .insert({
        user_id: userId,
        name_encrypted: encryptedName,
        type: entity.type,
        details: details,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('[EntityMemory] Failed to create visual entity:', error);
      return;
    }
    
    // Add to local cache
    this.entities.push({
      id: data.id,
      name: entity.name,
      type: entity.type,
      details: details,
      first_seen: data.first_seen,
      last_seen: data.last_seen
    });
    
    console.log(`[EntityMemory] Created entity with visual: ${entity.name}`);
  }
};
```

### 3.2 Update Context Generation to Include Visuals

Update `getContextForAnalysis()` to include visual details:

```javascript
getContextForAnalysis() {
  if (!this.entities || this.entities.length === 0) {
    return { knownEntities: [], summary: '' };
  }
  
  const knownEntities = this.entities.map(e => ({
    name: e.name,
    type: e.type,
    relationship: e.relationship_to_user || null,
    details: e.details || null,  // This now includes visual descriptions
    userCorrected: e.user_corrected || false
  }));
  
  return { knownEntities };
}
```

### 3.3 Update XML Generation in api/analyze.js

Ensure visual details appear in entity context:

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
    
    // Include visual details in description
    let description = e.relationship 
      ? `User's ${e.relationship}`
      : `A ${e.type} the user knows`;
    
    if (e.details) {
      description += `. ${e.details}`;
    }
    
    return `  <entity ${attrs.join(' ')}>${description}</entity>`;
  }).join('\n');
  
  return `
<known_entities>
${entityXML}
</known_entities>

CRITICAL: When referencing entities, use all available context including visual descriptions.
- If an entity has visual details, you can reference them naturally
- Example: "your golden retriever Seri" or "Seri with the red collar"
`;
}
```

---

## 4. Testing Checklist

### Test 1: New Entity from Image
- [ ] Upload a photo of a pet (e.g., dog)
- [ ] Add note text: "Walking with Seri today"
- [ ] Verify analysis completes
- [ ] Check Supabase `entities` table
- [ ] Confirm `details` field contains: "Visual: [description]"

### Test 2: Existing Entity Gets Visual
- [ ] Create text note first: "Need to feed Seri"
- [ ] Verify Seri entity created (no visual)
- [ ] Upload photo of Seri with note: "Seri at the park"
- [ ] Check Supabase `entities` table
- [ ] Confirm Seri's `details` field now has visual description

### Test 3: Visual Context in Output
- [ ] After storing visual, create new text note: "Seri seems tired"
- [ ] Check output references visual details
- [ ] Should say something like "your golden retriever Seri" not just "Seri"

### Test 4: Multiple Visuals
- [ ] Upload another photo of same entity
- [ ] Verify visual description appends (doesn't overwrite)
- [ ] Check details field has multiple observations

### Test 5: Person Entity
- [ ] Upload photo with a person
- [ ] Note: "Meeting with Sarah"
- [ ] Check entity created with visual description
- [ ] Verify respectful description (no judgmental language)

---

## 5. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| No entities in image | No visual_entities block returned |
| Blurry/unclear image | Skip visual extraction or note uncertainty |
| Same entity, different photos | Append visual descriptions |
| User in photo (selfie) | Check About Me profile, don't create "unknown person" |
| Multiple entities in one photo | Extract all with separate visual tags |

---

## 6. Privacy Considerations

- Visual descriptions are stored in `details` field (not separately encrypted)
- Descriptions should be factual, not judgmental
- For people: describe clothing, accessories, context — not physical judgments
- User can edit/delete via Entity Corrections UI

---

## 7. Success Criteria

After implementation:

1. ✅ Photos contribute to entity knowledge
2. ✅ Visual descriptions persist in database
3. ✅ Future outputs reference visual context naturally
4. ✅ Twin "remembers" what entities look like
5. ✅ Multiple photos enrich entity understanding

---

## 8. Files to Modify

| File | Changes |
|------|---------|
| `api/analyze.js` | Add visual extraction prompt, parse visual entities |
| `js/analyzer.js` | Handle visual entities in response, call storage |
| `js/entity-memory.js` | Add storeEntityWithVisual(), mergeVisualDescription() |

---

## 9. Version

Update to `5.1.3` after implementation.

---

*Specification created: January 15, 2026*
