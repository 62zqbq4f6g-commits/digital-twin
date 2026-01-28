/**
 * Encrypted Database Layer
 *
 * All database operations encrypt before save, decrypt after load.
 * This is the ONLY module that should touch the database for user content.
 *
 * Depends on:
 * - encryption.js (window.Encryption)
 * - key-manager.js (window.KeyManager)
 * - Supabase client (window.supabase or Sync.supabase)
 *
 * @version 1.0.0
 * @module encrypted-db
 */

// ============================================
// SUPABASE CLIENT ACCESS
// ============================================

/**
 * Get Supabase client
 * @returns {object} Supabase client
 */
function getSupabase() {
  // Try Sync module first (preferred)
  if (typeof Sync !== 'undefined' && Sync.supabase) {
    return Sync.supabase;
  }

  // Fallback to window.supabase
  if (window.supabase && window.ENV && window.ENV.SUPABASE_URL) {
    return window.supabase.createClient(
      window.ENV.SUPABASE_URL,
      window.ENV.SUPABASE_ANON_KEY
    );
  }

  throw new Error('Supabase client not available');
}

// ============================================
// KEY REQUIREMENT
// ============================================

/**
 * Ensure we have encryption key before operations
 * @returns {CryptoKey}
 * @throws {Error} If not unlocked
 */
function requireKey() {
  if (!window.Encryption) {
    throw new Error('Encryption module not loaded');
  }

  const key = window.Encryption.getCachedKey();
  if (!key) {
    throw new Error('Encryption key not available. Please unlock first.');
  }
  return key;
}

/**
 * Check if database operations are available
 * @returns {boolean}
 */
function isReady() {
  if (!window.Encryption) return false;
  return window.Encryption.isUnlocked();
}

// ============================================
// NOTES
// ============================================

/**
 * Save note (encrypted)
 * @param {string} userId
 * @param {string} content
 * @param {object} metadata - Optional metadata (not encrypted)
 * @returns {Promise<object>} Saved note with decrypted content
 */
async function saveNote(userId, content, metadata = {}) {
  const key = requireKey();
  const supabase = getSupabase();
  const encrypted = await window.Encryption.encrypt(content, key);

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      content_encrypted: encrypted,
      is_encrypted: true,
      ...metadata
    })
    .select()
    .single();

  if (error) throw error;

  // Ingest into Knowledge Graph (async, don't block)
  if (typeof window !== 'undefined' && window.ingestInput) {
    window.ingestInput(userId, {
      type: 'note',
      content: content,
      sourceId: data.id,
      timestamp: data.created_at
    }).catch(err => console.warn('[EncryptedDB] Knowledge graph ingestion error:', err));
  }

  return {
    ...data,
    content: content // Return decrypted for immediate use
  };
}

/**
 * Update note (encrypted)
 * @param {string} noteId
 * @param {string} content
 * @returns {Promise<object>}
 */
async function updateNote(noteId, content) {
  const key = requireKey();
  const supabase = getSupabase();
  const encrypted = await window.Encryption.encrypt(content, key);

  const { data, error } = await supabase
    .from('notes')
    .update({
      content_encrypted: encrypted,
      is_encrypted: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;

  // Ingest update into Knowledge Graph (async, don't block)
  if (typeof window !== 'undefined' && window.ingestInput && data.user_id) {
    window.ingestInput(data.user_id, {
      type: 'note',
      content: content,
      sourceId: noteId,
      timestamp: data.updated_at
    }).catch(err => console.warn('[EncryptedDB] Knowledge graph ingestion error:', err));
  }

  return {
    ...data,
    content: content
  };
}

/**
 * Load notes (decrypted)
 * @param {string} userId
 * @param {object} options
 * @returns {Promise<object[]>}
 */
async function loadNotes(userId, options = {}) {
  const key = requireKey();
  const supabase = getSupabase();
  const {
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    ascending = false
  } = options;

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Decrypt all notes
  const decrypted = await Promise.all((data || []).map(async (note) => {
    if (note.is_encrypted && note.content_encrypted) {
      try {
        const content = await window.Encryption.decrypt(note.content_encrypted, key);
        return { ...note, content };
      } catch (e) {
        console.error('Failed to decrypt note:', note.id);
        return { ...note, content: '[Decryption failed]', _decryptionError: true };
      }
    }
    // Fallback for unencrypted notes (migration period)
    return note;
  }));

  return decrypted;
}

/**
 * Load single note (decrypted)
 * @param {string} noteId
 * @returns {Promise<object>}
 */
async function loadNote(noteId) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single();

  if (error) throw error;

  if (data.is_encrypted && data.content_encrypted) {
    data.content = await window.Encryption.decrypt(data.content_encrypted, key);
  }

  return data;
}

/**
 * Delete note
 * @param {string} noteId
 * @returns {Promise<boolean>}
 */
async function deleteNote(noteId) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
  return true;
}

/**
 * Search notes (decrypts matching notes)
 * Note: Search happens on encrypted data, so we fetch more and filter client-side
 * @param {string} userId
 * @param {string} query
 * @returns {Promise<object[]>}
 */
async function searchNotes(userId, query) {
  // For encrypted notes, we must load and decrypt, then search client-side
  const notes = await loadNotes(userId, { limit: 500 });
  const queryLower = query.toLowerCase();

  return notes.filter(note =>
    note.content && note.content.toLowerCase().includes(queryLower)
  );
}

// ============================================
// ENTITIES
// ============================================

/**
 * Save entity (encrypted)
 * @param {string} userId
 * @param {object} entity
 * @returns {Promise<object>}
 */
async function saveEntity(userId, entity) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('user_entities')
    .insert({
      user_id: userId,
      name_encrypted: await window.Encryption.encrypt(entity.name, key),
      summary_encrypted: entity.summary ? await window.Encryption.encrypt(entity.summary, key) : null,
      type: entity.type, // Type is not sensitive
      is_encrypted: true
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    name: entity.name,
    summary: entity.summary
  };
}

/**
 * Update entity (encrypted)
 * @param {string} entityId
 * @param {object} updates
 * @returns {Promise<object>}
 */
async function updateEntity(entityId, updates) {
  const key = requireKey();
  const supabase = getSupabase();

  const encryptedUpdates = {
    updated_at: new Date().toISOString()
  };

  if (updates.name !== undefined) {
    encryptedUpdates.name_encrypted = await window.Encryption.encrypt(updates.name, key);
  }
  if (updates.summary !== undefined) {
    encryptedUpdates.summary_encrypted = updates.summary ? await window.Encryption.encrypt(updates.summary, key) : null;
  }
  if (updates.type !== undefined) {
    encryptedUpdates.type = updates.type;
  }

  const { data, error } = await supabase
    .from('user_entities')
    .update(encryptedUpdates)
    .eq('id', entityId)
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    name: updates.name,
    summary: updates.summary
  };
}

/**
 * Load entities (decrypted)
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function loadEntities(userId) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return Promise.all((data || []).map(async (entity) => {
    if (entity.is_encrypted) {
      return {
        ...entity,
        name: entity.name_encrypted ? await window.Encryption.decrypt(entity.name_encrypted, key) : entity.name,
        summary: entity.summary_encrypted ? await window.Encryption.decrypt(entity.summary_encrypted, key) : entity.summary
      };
    }
    return entity;
  }));
}

/**
 * Load single entity (decrypted)
 * @param {string} entityId
 * @returns {Promise<object>}
 */
async function loadEntity(entityId) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('user_entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) throw error;

  if (data.is_encrypted) {
    data.name = data.name_encrypted ? await window.Encryption.decrypt(data.name_encrypted, key) : data.name;
    data.summary = data.summary_encrypted ? await window.Encryption.decrypt(data.summary_encrypted, key) : data.summary;
  }

  return data;
}

// ============================================
// FACTS
// ============================================

/**
 * Save fact (encrypted)
 * @param {string} userId
 * @param {string} entityId
 * @param {string} predicate
 * @param {string} objectText
 * @param {number} confidence
 * @returns {Promise<object>}
 */
async function saveFact(userId, entityId, predicate, objectText, confidence = 0.8) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('entity_facts')
    .insert({
      user_id: userId,
      entity_id: entityId,
      predicate: predicate, // Predicate stays plaintext (it's a category)
      object_encrypted: await window.Encryption.encrypt(objectText, key),
      confidence,
      is_encrypted: true
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    object_text: objectText
  };
}

/**
 * Load facts (decrypted)
 * @param {string} userId
 * @param {string} entityId - Optional filter by entity
 * @returns {Promise<object[]>}
 */
async function loadFacts(userId, entityId = null) {
  const key = requireKey();
  const supabase = getSupabase();

  let query = supabase
    .from('entity_facts')
    .select('*')
    .eq('user_id', userId);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return Promise.all((data || []).map(async (fact) => {
    if (fact.is_encrypted && fact.object_encrypted) {
      return {
        ...fact,
        object_text: await window.Encryption.decrypt(fact.object_encrypted, key)
      };
    }
    return fact;
  }));
}

// ============================================
// MIRROR MESSAGES
// ============================================

/**
 * Save mirror message (encrypted)
 * @param {string} conversationId
 * @param {string} role
 * @param {string} content
 * @returns {Promise<object>}
 */
async function saveMirrorMessage(conversationId, role, content) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('mirror_messages')
    .insert({
      conversation_id: conversationId,
      role: role,
      content_encrypted: await window.Encryption.encrypt(content, key),
      is_encrypted: true
    })
    .select()
    .single();

  if (error) throw error;

  // Ingest user messages into Knowledge Graph (async, don't block)
  // Only ingest user messages, not assistant responses
  if (role === 'user' && typeof window !== 'undefined' && window.ingestInput) {
    const userId = typeof Sync !== 'undefined' && Sync.user?.id ? Sync.user.id : null;
    if (userId) {
      window.ingestInput(userId, {
        type: 'mirror_message',
        content: content,
        sourceId: data.id,
        metadata: { conversationId },
        timestamp: data.created_at
      }).catch(err => console.warn('[EncryptedDB] Knowledge graph ingestion error:', err));
    }
  }

  return {
    ...data,
    content: content
  };
}

/**
 * Load mirror messages (decrypted)
 * @param {string} conversationId
 * @returns {Promise<object[]>}
 */
async function loadMirrorMessages(conversationId) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('mirror_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return Promise.all((data || []).map(async (msg) => {
    if (msg.is_encrypted && msg.content_encrypted) {
      return {
        ...msg,
        content: await window.Encryption.decrypt(msg.content_encrypted, key)
      };
    }
    return msg;
  }));
}

// ============================================
// PATTERNS
// ============================================

/**
 * Save pattern (encrypted)
 * @param {string} userId
 * @param {string} category
 * @param {string} description
 * @param {number} confidence
 * @returns {Promise<object>}
 */
async function savePattern(userId, category, description, confidence = 0.7) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('user_patterns')
    .insert({
      user_id: userId,
      category: category,
      description_encrypted: await window.Encryption.encrypt(description, key),
      confidence,
      is_encrypted: true
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    description: description
  };
}

/**
 * Load patterns (decrypted)
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function loadPatterns(userId) {
  const key = requireKey();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('user_patterns')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  return Promise.all((data || []).map(async (pattern) => {
    if (pattern.is_encrypted && pattern.description_encrypted) {
      return {
        ...pattern,
        description: await window.Encryption.decrypt(pattern.description_encrypted, key)
      };
    }
    return pattern;
  }));
}

// ============================================
// EXPORT
// ============================================

/**
 * Export all user data (decrypted JSON)
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function exportUserData(userId) {
  const supabase = getSupabase();

  const [notes, entities, facts, patterns] = await Promise.all([
    loadNotes(userId, { limit: 10000 }),
    loadEntities(userId),
    loadFacts(userId),
    loadPatterns(userId)
  ]);

  // Load mirror conversations and messages
  const { data: conversations } = await supabase
    .from('mirror_conversations')
    .select('*')
    .eq('user_id', userId);

  const key = requireKey();
  const mirrorData = await Promise.all((conversations || []).map(async (conv) => {
    const messages = await loadMirrorMessages(conv.id);
    let title = conv.title;
    if (conv.is_encrypted && conv.title_encrypted) {
      title = await window.Encryption.decrypt(conv.title_encrypted, key);
    }
    return { ...conv, title, messages };
  }));

  return {
    inscript_export: {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      encryption: 'decrypted_for_export',
      data: {
        notes,
        entities,
        facts,
        patterns,
        mirror_conversations: mirrorData
      }
    }
  };
}

// ============================================
// MIGRATION
// ============================================

/**
 * Migrate user's existing unencrypted data to encrypted
 * Call this after user sets up encryption
 * @param {string} userId
 * @returns {Promise<object>} Migration results
 */
async function migrateUserToEncryption(userId) {
  const key = requireKey();
  const supabase = getSupabase();

  const results = {
    notes: { total: 0, migrated: 0, errors: 0 },
    entities: { total: 0, migrated: 0, errors: 0 },
    facts: { total: 0, migrated: 0, errors: 0 },
    patterns: { total: 0, migrated: 0, errors: 0 }
  };

  // Migrate notes
  const { data: notes } = await supabase
    .from('notes')
    .select('id, content')
    .eq('user_id', userId)
    .eq('is_encrypted', false);

  results.notes.total = notes?.length || 0;

  for (const note of (notes || [])) {
    if (!note.content) continue;
    try {
      const encrypted = await window.Encryption.encrypt(note.content, key);
      await supabase
        .from('notes')
        .update({
          content_encrypted: encrypted,
          is_encrypted: true
        })
        .eq('id', note.id);
      results.notes.migrated++;
    } catch (e) {
      console.error('Failed to migrate note:', note.id, e);
      results.notes.errors++;
    }
  }

  // Migrate entities
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, summary')
    .eq('user_id', userId)
    .eq('is_encrypted', false);

  results.entities.total = entities?.length || 0;

  for (const entity of (entities || [])) {
    try {
      const updates = {
        is_encrypted: true,
        name_encrypted: entity.name ? await window.Encryption.encrypt(entity.name, key) : null,
        summary_encrypted: entity.summary ? await window.Encryption.encrypt(entity.summary, key) : null
      };
      await supabase
        .from('user_entities')
        .update(updates)
        .eq('id', entity.id);
      results.entities.migrated++;
    } catch (e) {
      console.error('Failed to migrate entity:', entity.id, e);
      results.entities.errors++;
    }
  }

  // Migrate facts
  const { data: facts } = await supabase
    .from('entity_facts')
    .select('id, object_text')
    .eq('user_id', userId)
    .eq('is_encrypted', false);

  results.facts.total = facts?.length || 0;

  for (const fact of (facts || [])) {
    if (!fact.object_text) continue;
    try {
      await supabase
        .from('entity_facts')
        .update({
          object_encrypted: await window.Encryption.encrypt(fact.object_text, key),
          is_encrypted: true
        })
        .eq('id', fact.id);
      results.facts.migrated++;
    } catch (e) {
      console.error('Failed to migrate fact:', fact.id, e);
      results.facts.errors++;
    }
  }

  // Migrate patterns
  const { data: patterns } = await supabase
    .from('user_patterns')
    .select('id, description')
    .eq('user_id', userId)
    .eq('is_encrypted', false);

  results.patterns.total = patterns?.length || 0;

  for (const pattern of (patterns || [])) {
    if (!pattern.description) continue;
    try {
      await supabase
        .from('user_patterns')
        .update({
          description_encrypted: await window.Encryption.encrypt(pattern.description, key),
          is_encrypted: true
        })
        .eq('id', pattern.id);
      results.patterns.migrated++;
    } catch (e) {
      console.error('Failed to migrate pattern:', pattern.id, e);
      results.patterns.errors++;
    }
  }

  return results;
}

/**
 * Get unencrypted record counts for migration progress
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getUnencryptedCounts(userId) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_unencrypted_counts', {
    p_user_id: userId
  });

  if (error) throw error;

  return data.reduce((acc, row) => {
    acc[row.table_name] = row.unencrypted_count;
    return acc;
  }, {});
}

// ============================================
// EXPORT
// ============================================

window.EncryptedDB = {
  // Status
  isReady,

  // Notes
  saveNote,
  updateNote,
  loadNotes,
  loadNote,
  deleteNote,
  searchNotes,

  // Entities
  saveEntity,
  updateEntity,
  loadEntities,
  loadEntity,

  // Facts
  saveFact,
  loadFacts,

  // Mirror
  saveMirrorMessage,
  loadMirrorMessages,

  // Patterns
  savePattern,
  loadPatterns,

  // Export
  exportUserData,

  // Migration
  migrateUserToEncryption,
  getUnencryptedCounts
};
