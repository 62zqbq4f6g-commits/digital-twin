/**
 * KNOWLEDGE GRAPH
 *
 * Central hub for ALL user data. Every input flows through here.
 * Everything gets connected. Nothing is siloed.
 *
 * @version 1.0.0
 * Phase 19 - Unified Knowledge Architecture
 */

// ============================================
// CORE INGESTION - Every input goes through here
// ============================================

/**
 * Ingest ANY user input into the knowledge graph
 * This is the ONE function that captures everything
 */
async function ingestInput(userId, input) {
  const {
    type,        // 'note', 'voice', 'meeting', 'mirror_message', 'onboarding', 'preference', 'feedback'
    content,     // The actual content
    metadata,    // Any additional data
    sourceId,    // ID of the source record (note_id, message_id, etc.)
    timestamp    // When it happened
  } = input;

  console.log(`[KnowledgeGraph] Ingesting ${type}:`, content?.substring(0, 50));

  const supabase = KnowledgeGraph.getSupabase();
  if (!supabase) {
    console.warn('[KnowledgeGraph] Supabase not available');
    return { entities: [], facts: [] };
  }

  try {
    // 1. Store the raw input reference
    await KnowledgeGraph.storeInputReference(userId, input);

    // 2. Use enhanced LLM extraction for richer analysis (Phase 19)
    const extraction = await KnowledgeGraph.enhancedExtraction(userId, content, type);

    // 3. Process extracted entities
    const entities = extraction.entities || [];
    const facts = extraction.facts || [];

    // 4. Save behaviors and relationship qualities (Phase 19 - Intent-Aware)
    if (extraction.behaviors?.length > 0 || extraction.relationship_qualities?.length > 0) {
      await KnowledgeGraph.saveBehaviors(userId, extraction, sourceId, type);
    }

    // 5. Link to existing knowledge
    await KnowledgeGraph.linkToExistingKnowledge(userId, sourceId, type, entities, facts);

    // 6. Update user profile/preferences if relevant
    if (type === 'onboarding' || type === 'preference') {
      await KnowledgeGraph.updateUserProfile(userId, input);
    }

    // 7. Trigger pattern detection if enough new data
    await KnowledgeGraph.maybeUpdatePatterns(userId);

    return {
      entities,
      facts,
      behaviors: extraction.behaviors || [],
      relationship_qualities: extraction.relationship_qualities || []
    };
  } catch (error) {
    console.error('[KnowledgeGraph] Ingestion error:', error);
    return { entities: [], facts: [], behaviors: [], relationship_qualities: [] };
  }
}

/**
 * Get FULL context for MIRROR - the holy grail
 * Phase 19: Now includes user behaviors and relationship qualities
 */
async function getFullContext(userId, query) {
  const supabase = KnowledgeGraph.getSupabase();
  if (!supabase) {
    console.warn('[KnowledgeGraph] Supabase not available');
    return {};
  }

  try {
    const context = {
      // User profile & preferences
      profile: await KnowledgeGraph.getUserProfile(userId),

      // Recent notes (last 7 days)
      recentNotes: await KnowledgeGraph.getRecentNotes(userId, 7),

      // ALL notes (summary)
      notesCount: await KnowledgeGraph.getNoteCount(userId),

      // Entities and their facts
      entities: await KnowledgeGraph.getEntitiesWithFacts(userId),

      // Entity relationships
      relationships: await KnowledgeGraph.getEntityRelationships(userId),

      // Patterns
      patterns: await KnowledgeGraph.getPatterns(userId),

      // Phase 19: User behaviors (who they trust, rely on, seek advice from)
      behaviors: await KnowledgeGraph.getUserBehaviors(userId),

      // Phase 19: Entity qualities (how entities relate to the user)
      entityQualities: await KnowledgeGraph.getEntityQualities(userId),

      // Onboarding data
      onboarding: await KnowledgeGraph.getOnboardingData(userId),

      // Recent MIRROR conversations
      recentConversations: await KnowledgeGraph.getRecentMirrorContext(userId),

      // Relevant context for this specific query
      queryRelevant: await KnowledgeGraph.getQueryRelevantContext(userId, query)
    };

    return context;
  } catch (error) {
    console.error('[KnowledgeGraph] getFullContext error:', error);
    return {};
  }
}

// ============================================
// KNOWLEDGE GRAPH MODULE
// ============================================

const KnowledgeGraph = {
  // Skip words for entity extraction
  SKIP_WORDS: new Set([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
    'The', 'This', 'That', 'What', 'When', 'Where', 'Why', 'How', 'Which',
    'Today', 'Tomorrow', 'Yesterday', 'Hello', 'Thanks', 'Please', 'Sorry',
    'Really', 'Actually', 'Maybe', 'Perhaps', 'Probably', 'Definitely',
    'Good', 'Great', 'Nice', 'Bad', 'Well', 'Just', 'Also', 'Still'
  ]),

  lastPatternUpdate: 0,

  /**
   * Get Supabase client
   */
  getSupabase() {
    if (typeof Sync !== 'undefined' && Sync.supabase) {
      return Sync.supabase;
    }
    if (typeof window !== 'undefined' && window.supabase) {
      return window.supabase;
    }
    return null;
  },

  /**
   * Get current user ID
   */
  getUserId() {
    if (typeof Sync !== 'undefined' && Sync.user?.id) {
      return Sync.user.id;
    }
    return null;
  },

  // ============================================
  // INPUT REFERENCE TRACKING
  // ============================================

  /**
   * Store reference to every input for full traceability
   */
  async storeInputReference(userId, input) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    try {
      await supabase
        .from('user_inputs')
        .insert({
          user_id: userId,
          input_type: input.type,
          source_id: input.sourceId || null,
          content_preview: input.content?.substring(0, 200) || null,
          metadata: input.metadata || {},
          created_at: input.timestamp || new Date().toISOString()
        });
    } catch (error) {
      console.warn('[KnowledgeGraph] Failed to store input reference:', error);
    }
  },

  // ============================================
  // ENTITY EXTRACTION
  // ============================================

  /**
   * Extract entities from any content
   * Uses pattern matching for names and companies
   */
  async extractEntities(userId, content, sourceType) {
    if (!content) return [];

    const entities = [];
    const seenNames = new Set();

    // Quick pattern extraction for names (capitalized words)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    const potentialNames = content.match(namePattern) || [];

    for (const name of potentialNames) {
      if (this.SKIP_WORDS.has(name) || name.length <= 2 || seenNames.has(name.toLowerCase())) {
        continue;
      }
      seenNames.add(name.toLowerCase());

      // Check if entity exists
      let entity = await this.findEntityByName(userId, name);

      if (!entity) {
        // Create new entity
        entity = await this.createEntity(userId, name, 'person');
      }

      if (entity) {
        // Track mention
        await this.trackMention(userId, entity.id, sourceType, content);
        entities.push(entity);
      }
    }

    // Extract companies (patterns like "at Company", "works at X")
    const companyPattern = /(?:at|for|with|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/g;
    let match;
    while ((match = companyPattern.exec(content)) !== null) {
      const companyName = match[1].trim();
      if (!this.SKIP_WORDS.has(companyName) && !seenNames.has(companyName.toLowerCase())) {
        seenNames.add(companyName.toLowerCase());
        let entity = await this.findEntityByName(userId, companyName);
        if (!entity) {
          entity = await this.createEntity(userId, companyName, 'company');
        }
        if (entity) {
          entities.push(entity);
        }
      }
    }

    return entities;
  },

  async findEntityByName(userId, name) {
    const supabase = this.getSupabase();
    if (!supabase) return null;

    try {
      const { data } = await supabase
        .from('user_entities')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', name)
        .limit(1)
        .maybeSingle();
      return data;
    } catch (error) {
      console.warn('[KnowledgeGraph] findEntityByName error:', error);
      return null;
    }
  },

  async createEntity(userId, name, type) {
    const supabase = this.getSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('user_entities')
        .insert({
          user_id: userId,
          name: name,
          entity_type: type,
          mention_count: 1,
          first_mentioned: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.warn('[KnowledgeGraph] Failed to create entity:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.warn('[KnowledgeGraph] createEntity error:', error);
      return null;
    }
  },

  async trackMention(userId, entityId, sourceType, context) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    try {
      // Increment mention count
      await supabase.rpc('increment_mention_count', { p_entity_id: entityId });

      // Store the mention context for future reference
      await supabase
        .from('entity_mentions')
        .insert({
          user_id: userId,
          entity_id: entityId,
          source_type: sourceType,
          context_snippet: context?.substring(0, 500) || null,
          mentioned_at: new Date().toISOString()
        });
    } catch (error) {
      // RPC might not exist yet, try direct update
      try {
        await supabase
          .from('user_entities')
          .update({
            mention_count: supabase.sql`COALESCE(mention_count, 0) + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', entityId);
      } catch (e) {
        console.warn('[KnowledgeGraph] trackMention error:', e);
      }
    }
  },

  // ============================================
  // FACT EXTRACTION
  // ============================================

  /**
   * Extract facts and relationships from content
   */
  async extractFacts(userId, content, entities) {
    if (!content || entities.length === 0) return [];

    const facts = [];

    // Pattern: "X works at Y" / "X is at Y"
    const worksAtPattern = /(\w+)\s+(?:works|working)\s+(?:at|for)\s+([A-Z][a-zA-Z\s]+)/gi;
    let match;
    while ((match = worksAtPattern.exec(content)) !== null) {
      const personName = match[1];
      const companyName = match[2].trim();

      const person = entities.find(e => e.name.toLowerCase().includes(personName.toLowerCase()));
      if (person) {
        facts.push({
          entity_id: person.id,
          predicate: 'works_at',
          object_text: companyName,
          confidence: 0.8
        });
      }
    }

    // Pattern: "X is my Y" (relationship)
    const relationPattern = /(\w+)\s+is\s+my\s+(friend|colleague|boss|wife|husband|partner|sister|brother|mom|dad|mother|father|coworker|mentor|manager)/gi;
    while ((match = relationPattern.exec(content)) !== null) {
      const personName = match[1];
      const relationship = match[2];

      const person = entities.find(e => e.name.toLowerCase().includes(personName.toLowerCase()));
      if (person) {
        facts.push({
          entity_id: person.id,
          predicate: 'relationship',
          object_text: relationship,
          confidence: 0.9
        });
      }
    }

    // Pattern: "X's Y is Z" (possessive facts)
    const possessivePattern = /([A-Z][a-z]+)'s\s+(email|phone|birthday|company|role|title|job)\s+is\s+([^\.\n]+)/gi;
    while ((match = possessivePattern.exec(content)) !== null) {
      const personName = match[1];
      const attribute = match[2];
      const value = match[3].trim();

      const person = entities.find(e => e.name.toLowerCase() === personName.toLowerCase());
      if (person) {
        facts.push({
          entity_id: person.id,
          predicate: attribute,
          object_text: value,
          confidence: 0.85
        });
      }
    }

    // Save facts to database
    for (const fact of facts) {
      await this.saveFact(userId, fact);
    }

    return facts;
  },

  async saveFact(userId, fact) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    try {
      // Check if fact already exists
      const { data: existing } = await supabase
        .from('entity_facts')
        .select('id, confidence')
        .eq('user_id', userId)
        .eq('entity_id', fact.entity_id)
        .eq('predicate', fact.predicate)
        .eq('object_text', fact.object_text)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update confidence if higher
        if (fact.confidence > (existing.confidence || 0)) {
          await supabase
            .from('entity_facts')
            .update({
              confidence: fact.confidence,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } else {
        // Insert new fact
        await supabase
          .from('entity_facts')
          .insert({
            user_id: userId,
            entity_id: fact.entity_id,
            predicate: fact.predicate,
            object_text: fact.object_text,
            confidence: fact.confidence
          });
      }
    } catch (error) {
      console.warn('[KnowledgeGraph] saveFact error:', error);
    }
  },

  // ============================================
  // PHASE 19: ENHANCED LLM EXTRACTION
  // ============================================

  /**
   * Use LLM for enhanced extraction with intent-aware analysis
   * This extracts behaviors, relationship qualities, not just entities and facts
   */
  async enhancedExtraction(userId, content, sourceType) {
    if (!content || content.length < 10) {
      return { entities: [], facts: [], behaviors: [], relationship_qualities: [] };
    }

    try {
      // Get existing entities for context
      const existingEntities = await this.getKnownEntityNames(userId);

      // Get auth token
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        console.warn('[KnowledgeGraph] No auth token for LLM extraction');
        return this.fallbackExtraction(userId, content, sourceType);
      }

      // Call enhanced extract-entities API
      const response = await fetch('/api/extract-entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: content,
          knownEntities: existingEntities
        })
      });

      if (!response.ok) {
        console.warn('[KnowledgeGraph] Extract API failed:', response.status);
        return this.fallbackExtraction(userId, content, sourceType);
      }

      const result = await response.json();
      console.log('[KnowledgeGraph] Enhanced extraction:', {
        entities: result.entities?.length || 0,
        facts: result.facts?.length || 0,
        behaviors: result.behaviors?.length || 0,
        relationship_qualities: result.relationship_qualities?.length || 0
      });

      // Process extracted entities - save to database
      const savedEntities = [];
      const entityMap = {}; // For behavior linking

      for (const entity of (result.entities || [])) {
        let savedEntity = await this.findEntityByName(userId, entity.name);
        if (!savedEntity) {
          savedEntity = await this.createEntity(userId, entity.name, entity.type || 'person');
        }
        if (savedEntity) {
          await this.trackMention(userId, savedEntity.id, sourceType, content);
          savedEntities.push(savedEntity);
          entityMap[entity.name] = savedEntity.id;
          entityMap[entity.name.toLowerCase()] = savedEntity.id;
        }
      }

      // Save extracted facts
      for (const fact of (result.facts || [])) {
        const entityId = entityMap[fact.entity_name] || entityMap[fact.entity_name?.toLowerCase()];
        if (entityId) {
          await this.saveFact(userId, {
            entity_id: entityId,
            predicate: fact.predicate,
            object_text: fact.object,
            confidence: fact.confidence || 0.8
          });
        }
      }

      return {
        entities: savedEntities,
        facts: result.facts || [],
        behaviors: result.behaviors || [],
        relationship_qualities: result.relationship_qualities || [],
        entityMap
      };
    } catch (error) {
      console.error('[KnowledgeGraph] Enhanced extraction error:', error);
      return this.fallbackExtraction(userId, content, sourceType);
    }
  },

  /**
   * Fallback to pattern-based extraction if LLM fails
   */
  async fallbackExtraction(userId, content, sourceType) {
    const entities = await this.extractEntities(userId, content, sourceType);
    const facts = await this.extractFacts(userId, content, entities);
    return { entities, facts, behaviors: [], relationship_qualities: [] };
  },

  /**
   * Get known entity names for context
   */
  async getKnownEntityNames(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data } = await supabase
        .from('user_entities')
        .select('name, summary')
        .eq('user_id', userId)
        .order('mention_count', { ascending: false })
        .limit(30);

      return (data || []).map(e => ({ name: e.name, summary: e.summary }));
    } catch (error) {
      return [];
    }
  },

  /**
   * Save behaviors and relationship qualities via API
   */
  async saveBehaviors(userId, extraction, sourceNoteId, sourceType) {
    const { behaviors, relationship_qualities, entityMap } = extraction;

    if ((!behaviors || behaviors.length === 0) && (!relationship_qualities || relationship_qualities.length === 0)) {
      return;
    }

    try {
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (!token) {
        console.warn('[KnowledgeGraph] No auth token for saving behaviors');
        return;
      }

      const response = await fetch('/api/save-behaviors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          behaviors: behaviors || [],
          relationshipQualities: relationship_qualities || [],
          entityMap: entityMap || {},
          sourceNoteId,
          sourceType
        })
      });

      if (!response.ok) {
        console.warn('[KnowledgeGraph] Save behaviors API failed:', response.status);
        return;
      }

      const result = await response.json();
      console.log('[KnowledgeGraph] Behaviors saved:', result);
    } catch (error) {
      console.error('[KnowledgeGraph] saveBehaviors error:', error);
    }
  },

  // ============================================
  // KNOWLEDGE LINKING
  // ============================================

  /**
   * Link new input to existing knowledge
   */
  async linkToExistingKnowledge(userId, sourceId, sourceType, entities, facts) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    // Create note_entity links
    if (sourceType === 'note' && sourceId) {
      for (const entity of entities) {
        try {
          await supabase
            .from('note_entities')
            .upsert({
              note_id: sourceId,
              entity_id: entity.id,
              user_id: userId
            }, { onConflict: 'note_id,entity_id' });
        } catch (error) {
          // Table might not exist yet
          console.warn('[KnowledgeGraph] note_entities upsert error:', error);
        }
      }
    }

    // Link entities to each other if mentioned together
    if (entities.length > 1) {
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          await this.linkEntities(userId, entities[i].id, entities[j].id, sourceType);
        }
      }
    }
  },

  async linkEntities(userId, entityId1, entityId2, context) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    try {
      // Check if link exists (either direction) - use separate queries to avoid filter injection
      // First check A→B direction
      let existing = null;
      const { data: linkAB } = await supabase
        .from('entity_links')
        .select('id, strength')
        .eq('user_id', userId)
        .eq('entity_a', entityId1)
        .eq('entity_b', entityId2)
        .limit(1)
        .maybeSingle();

      if (linkAB) {
        existing = linkAB;
      } else {
        // Check B→A direction
        const { data: linkBA } = await supabase
          .from('entity_links')
          .select('id, strength')
          .eq('user_id', userId)
          .eq('entity_a', entityId2)
          .eq('entity_b', entityId1)
          .limit(1)
          .maybeSingle();
        existing = linkBA;
      }

      if (existing) {
        // Strengthen existing link
        await supabase
          .from('entity_links')
          .update({
            strength: (existing.strength || 1) + 1,
            last_seen: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Create new link
        await supabase
          .from('entity_links')
          .insert({
            user_id: userId,
            entity_a: entityId1,
            entity_b: entityId2,
            context: context,
            strength: 1
          });
      }
    } catch (error) {
      console.warn('[KnowledgeGraph] linkEntities error:', error);
    }
  },

  // ============================================
  // USER PROFILE UPDATES
  // ============================================

  /**
   * Update user profile from onboarding/preferences
   */
  async updateUserProfile(userId, input) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    const { type, content, metadata } = input;

    try {
      if (type === 'onboarding') {
        // Map onboarding fields to user_settings
        const fields = metadata?.fields || {};
        for (const [key, value] of Object.entries(fields)) {
          await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              setting_key: `onboarding_${key}`,
              setting_value: typeof value === 'string' ? value : JSON.stringify(value),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,setting_key' });
        }
      }

      if (type === 'preference' && metadata?.key) {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: userId,
            setting_key: `pref_${metadata.key}`,
            setting_value: content,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,setting_key' });
      }
    } catch (error) {
      console.warn('[KnowledgeGraph] updateUserProfile error:', error);
    }
  },

  // ============================================
  // PATTERN DETECTION
  // ============================================

  async maybeUpdatePatterns(userId) {
    const now = Date.now();
    // Only update patterns every 5 minutes max
    if (now - this.lastPatternUpdate < 5 * 60 * 1000) return;

    this.lastPatternUpdate = now;

    // Trigger async pattern detection (don't await)
    this.detectPatterns(userId).catch(err =>
      console.warn('[KnowledgeGraph] Pattern detection error:', err)
    );
  },

  async detectPatterns(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return;

    try {
      // Count recent inputs
      const { count } = await supabase
        .from('user_inputs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      // Need at least 10 inputs in last week to detect patterns
      if (!count || count < 10) return;

      // Trigger pattern analysis API
      const token = typeof Sync !== 'undefined' ? await Sync.getToken() : null;
      if (token) {
        fetch('/api/patterns', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'auto_detect', userId })
        }).catch(err => console.warn('[KnowledgeGraph] Pattern API error:', err));
      }
    } catch (error) {
      console.warn('[KnowledgeGraph] detectPatterns error:', error);
    }
  },

  // ============================================
  // KNOWLEDGE RETRIEVAL FOR MIRROR
  // ============================================

  async getUserProfile(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return null;

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      return data;
    } catch (error) {
      return null;
    }
  },

  async getRecentNotes(userId, days) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('notes')
        .select('id, content, created_at, updated_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);

      return data || [];
    } catch (error) {
      return [];
    }
  },

  async getNoteCount(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return 0;

    try {
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count || 0;
    } catch (error) {
      return 0;
    }
  },

  async getEntitiesWithFacts(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data: entities } = await supabase
        .from('user_entities')
        .select(`
          id, name, entity_type, summary, mention_count
        `)
        .eq('user_id', userId)
        .order('mention_count', { ascending: false, nullsFirst: false })
        .limit(50);

      // Fetch facts separately to avoid FK ambiguity
      if (entities && entities.length > 0) {
        const entityIds = entities.map(e => e.id);
        const { data: facts } = await supabase
          .from('entity_facts')
          .select('entity_id, predicate, object_text, confidence')
          .eq('user_id', userId)
          .in('entity_id', entityIds);

        // Attach facts to entities
        const factsMap = {};
        (facts || []).forEach(f => {
          if (!factsMap[f.entity_id]) factsMap[f.entity_id] = [];
          factsMap[f.entity_id].push({
            predicate: f.predicate,
            object_text: f.object_text,
            confidence: f.confidence
          });
        });
        entities.forEach(e => {
          e.entity_facts = factsMap[e.id] || [];
        });
      }

      return entities || [];
    } catch (error) {
      return [];
    }
  },

  async getEntityRelationships(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data } = await supabase
        .from('entity_links')
        .select(`
          entity_a,
          entity_b,
          strength,
          context
        `)
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .limit(30);

      return data || [];
    } catch (error) {
      return [];
    }
  },

  async getPatterns(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data } = await supabase
        .from('user_patterns')
        .select('category, description, confidence')
        .eq('user_id', userId)
        .gte('confidence', 0.6)
        .order('confidence', { ascending: false });

      return data || [];
    } catch (error) {
      return [];
    }
  },

  async getOnboardingData(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return {};

    try {
      // Use onboarding_data table (same as rest of app) for consistency
      const { data, error } = await supabase
        .from('onboarding_data')
        .select('name, life_seasons, mental_focus, depth_question, depth_answer, seeded_people')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        console.warn('[KnowledgeGraph] Could not fetch onboarding data:', error?.message);
        return {};
      }

      return {
        name: data.name,
        lifeSeasons: data.life_seasons || [],
        mentalFocus: data.mental_focus || [],
        depthQuestion: data.depth_question,
        depthAnswer: data.depth_answer,
        seededPeople: data.seeded_people || []
      };
    } catch (error) {
      console.warn('[KnowledgeGraph] Onboarding data error:', error);
      return {};
    }
  },

  async getRecentMirrorContext(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data } = await supabase
        .from('mirror_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      return data || [];
    } catch (error) {
      return [];
    }
  },

  async getQueryRelevantContext(userId, query) {
    if (!query) return { entities: [], notes: [] };

    const supabase = this.getSupabase();
    if (!supabase) return { entities: [], notes: [] };

    try {
      // Extract potential entity names from query
      const namePattern = /\b([A-Z][a-z]+)\b/g;
      const names = query.match(namePattern) || [];

      // Sanitize names: only allow alphanumeric + common chars, max length
      const sanitizedNames = names
        .map(n => n.replace(/[^a-zA-Z0-9\s\-']/g, '').slice(0, 50))
        .filter(n => n.length >= 2);

      let relevantEntities = [];
      if (sanitizedNames.length > 0) {
        const orConditions = sanitizedNames.map(n => `name.ilike.%${n}%`).join(',');
        const { data } = await supabase
          .from('user_entities')
          .select('*, entity_facts(*)')
          .eq('user_id', userId)
          .or(orConditions);
        relevantEntities = data || [];
      }

      // Get notes matching query keywords
      const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

      // Sanitize keywords: only allow alphanumeric, max length
      const sanitizedKeywords = keywords
        .map(k => k.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50))
        .filter(k => k.length >= 3);

      let relevantNotes = [];

      if (sanitizedKeywords.length > 0) {
        const orConditions = sanitizedKeywords.map(k => `content.ilike.%${k}%`).join(',');
        const { data } = await supabase
          .from('notes')
          .select('id, content, created_at')
          .eq('user_id', userId)
          .or(orConditions)
          .limit(10);
        relevantNotes = data || [];
      }

      return {
        entities: relevantEntities,
        notes: relevantNotes
      };
    } catch (error) {
      return { entities: [], notes: [] };
    }
  },

  // ============================================
  // PHASE 19: BEHAVIORAL PROFILE RETRIEVAL
  // ============================================

  /**
   * Get user's behavioral patterns (who they trust, rely on, seek advice from)
   */
  async getUserBehaviors(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_behaviors')
        .select(`
          predicate,
          entity_name,
          topic,
          sentiment,
          confidence,
          reinforcement_count
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('confidence', { ascending: false })
        .order('reinforcement_count', { ascending: false })
        .limit(30);

      if (error) {
        // Table might not exist yet
        console.warn('[KnowledgeGraph] getUserBehaviors error:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('[KnowledgeGraph] getUserBehaviors error:', error);
      return [];
    }
  },

  /**
   * Get entity qualities (how entities relate to the user)
   */
  async getEntityQualities(userId) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('entity_qualities')
        .select(`
          entity_name,
          predicate,
          object,
          confidence,
          reinforcement_count
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('confidence', { ascending: false })
        .order('reinforcement_count', { ascending: false })
        .limit(30);

      if (error) {
        // Table might not exist yet
        console.warn('[KnowledgeGraph] getEntityQualities error:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('[KnowledgeGraph] getEntityQualities error:', error);
      return [];
    }
  },

  /**
   * Get behaviors related to a specific entity
   */
  async getBehaviorsForEntity(userId, entityName) {
    const supabase = this.getSupabase();
    if (!supabase) return [];

    try {
      const { data } = await supabase
        .from('user_behaviors')
        .select('*')
        .eq('user_id', userId)
        .ilike('entity_name', entityName)
        .eq('status', 'active');

      return data || [];
    } catch (error) {
      return [];
    }
  }
};

// ============================================
// EXPORTS
// ============================================

// Export for global access
if (typeof window !== 'undefined') {
  window.KnowledgeGraph = KnowledgeGraph;
  window.ingestInput = ingestInput;
  window.getFullContext = getFullContext;
}

// For ES module imports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KnowledgeGraph, ingestInput, getFullContext };
}
