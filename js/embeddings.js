/**
 * PHASE 10.3: Semantic Search via Embeddings
 * Uses OpenAI embeddings + pgvector for similarity search
 */

window.Embeddings = {

  /**
   * Generate embedding via API endpoint
   * @param {string} text - Text to embed
   * @returns {Promise<Array|null>} 1536-dimension embedding vector
   */
  async generate(text) {
    if (!text || text.trim().length < 3) return null;

    try {
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.substring(0, 8000) })
      });

      if (!response.ok) {
        console.error('[Embeddings] API error:', response.status);
        return null;
      }

      const data = await response.json();
      return data.embedding;
    } catch (err) {
      console.error('[Embeddings] Generate error:', err);
      return null;
    }
  },

  /**
   * Store embedding for an entity
   * @param {string} entityId - Entity UUID
   * @param {string} text - Text to embed
   * @param {Object} supabase - Supabase client
   */
  async storeEntityEmbedding(entityId, text, supabase) {
    const embedding = await this.generate(text);
    if (!embedding) return false;

    const { error } = await supabase
      .from('user_entities')
      .update({ embedding })
      .eq('id', entityId);

    if (error) {
      console.error('[Embeddings] Store error:', error);
      return false;
    }

    console.log('[Embeddings] Stored embedding for entity:', entityId);
    return true;
  },

  /**
   * Store embedding for a note
   * @param {string} noteId - Note UUID
   * @param {string} text - Text to embed
   * @param {Object} supabase - Supabase client
   */
  async storeNoteEmbedding(noteId, text, supabase) {
    const embedding = await this.generate(text);
    if (!embedding) return false;

    const { error } = await supabase
      .from('notes')
      .update({ embedding })
      .eq('id', noteId);

    if (error) {
      console.error('[Embeddings] Store note embedding error:', error);
      return false;
    }

    console.log('[Embeddings] Stored embedding for note:', noteId);
    return true;
  },

  /**
   * Semantic search for entities
   * @param {string} userId - User UUID
   * @param {string} query - Search query
   * @param {Object} supabase - Supabase client
   * @param {number} limit - Max results
   */
  async searchEntities(userId, query, supabase, limit = 10) {
    const queryEmbedding = await this.generate(query);
    if (!queryEmbedding) return [];

    const { data, error } = await supabase.rpc('match_entities', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.5,
      match_count: limit
    });

    if (error) {
      console.error('[Embeddings] Search error:', error);
      return [];
    }

    console.log(`[Embeddings] Found ${data?.length || 0} similar entities`);
    return data || [];
  },

  /**
   * Semantic search for notes
   * @param {string} userId - User UUID
   * @param {string} query - Search query
   * @param {Object} supabase - Supabase client
   * @param {number} limit - Max results
   */
  async searchNotes(userId, query, supabase, limit = 10) {
    const queryEmbedding = await this.generate(query);
    if (!queryEmbedding) return [];

    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.5,
      match_count: limit
    });

    if (error) {
      console.error('[Embeddings] Note search error:', error);
      return [];
    }

    console.log(`[Embeddings] Found ${data?.length || 0} similar notes`);
    return data || [];
  },

  /**
   * Backfill embeddings for existing entities without embeddings
   * @param {string} userId - User UUID
   * @param {Object} supabase - Supabase client
   */
  async backfillEntities(userId, supabase) {
    const { data: entities } = await supabase
      .from('user_entities')
      .select('id, name, context_notes, summary')
      .eq('user_id', userId)
      .eq('status', 'active')
      .is('embedding', null)
      .limit(20);

    if (!entities || entities.length === 0) {
      console.log('[Embeddings] No entities need backfill');
      return 0;
    }

    let count = 0;
    for (const entity of entities) {
      const text = [
        entity.name,
        entity.summary || '',
        ...(entity.context_notes || [])
      ].join(' ').trim();

      if (await this.storeEntityEmbedding(entity.id, text, supabase)) {
        count++;
      }

      // Rate limit - 200ms between requests
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[Embeddings] Backfilled ${count} entities`);
    return count;
  },

  /**
   * Backfill embeddings for existing notes without embeddings
   * @param {string} userId - User UUID
   * @param {Object} supabase - Supabase client
   */
  async backfillNotes(userId, supabase) {
    const { data: notes } = await supabase
      .from('notes')
      .select('id, content')
      .eq('user_id', userId)
      .is('embedding', null)
      .limit(20);

    if (!notes || notes.length === 0) {
      console.log('[Embeddings] No notes need backfill');
      return 0;
    }

    let count = 0;
    for (const note of notes) {
      if (note.content && await this.storeNoteEmbedding(note.id, note.content, supabase)) {
        count++;
      }

      // Rate limit - 200ms between requests
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[Embeddings] Backfilled ${count} notes`);
    return count;
  }
};

console.log('[Embeddings] Module loaded - Phase 10.3 Semantic Search');
