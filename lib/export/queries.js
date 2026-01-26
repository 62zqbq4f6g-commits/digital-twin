// /lib/export/queries.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)
// STATUS: Ready

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get user profile from user_profiles and onboarding_data
 */
export async function getProfile(user_id) {
  // Get from user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  // Get from onboarding_data
  const { data: onboarding, error: onboardingError } = await supabase
    .from('onboarding_data')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  // Get custom instructions from memory_preferences
  const { data: prefs, error: prefsError } = await supabase
    .from('memory_preferences')
    .select('custom_instructions')
    .eq('user_id', user_id)
    .maybeSingle();

  return {
    ...profile,
    ...onboarding,
    custom_instructions: prefs?.custom_instructions
  };
}

/**
 * Get key people (explicitly added by user)
 */
export async function getKeyPeople(user_id) {
  const { data, error } = await supabase
    .from('user_key_people')
    .select('name, relationship, created_at')
    .eq('user_id', user_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Export] Failed to get key people:', error);
    return [];
  }
  return data || [];
}

/**
 * Get all entities for user
 */
export async function getEntities(user_id) {
  const { data, error } = await supabase
    .from('user_entities')
    .select(`
      id,
      name,
      entity_type,
      summary,
      importance_score,
      sentiment_average,
      mention_count,
      is_historical,
      effective_from,
      expires_at,
      sensitivity_level,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('importance_score', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get entities:', error);
    return [];
  }
  return data || [];
}

/**
 * Get entity relationships
 */
export async function getEntityRelationships(user_id) {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select(`
      id,
      subject_entity_id,
      object_entity_id,
      predicate,
      strength,
      confidence,
      is_active
    `)
    .eq('user_id', user_id);

  if (error) {
    console.error('[Export] Failed to get relationships:', error);
    return [];
  }
  return data || [];
}

/**
 * Get all notes for user (decrypted)
 * NOTE: Notes are encrypted - need to handle decryption
 */
export async function getNotes(user_id) {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      id,
      content,
      note_type,
      category,
      sentiment,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get notes:', error);
    return [];
  }

  // TODO: Handle decryption if content is encrypted
  // For now, return as-is (may need to coordinate with existing decryption logic)
  return data || [];
}

/**
 * Get meeting history
 */
export async function getMeetings(user_id) {
  const { data, error } = await supabase
    .from('meeting_history')
    .select(`
      id,
      entity_id,
      note_id,
      meeting_date,
      topics,
      sentiment,
      action_items,
      created_at
    `)
    .eq('user_id', user_id)
    .order('meeting_date', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get meetings:', error);
    return [];
  }
  return data || [];
}

/**
 * Get MIRROR conversations WITH full message history
 */
export async function getConversations(user_id) {
  // Get conversations
  const { data: conversations, error: convError } = await supabase
    .from('mirror_conversations')
    .select(`
      id,
      status,
      summary,
      key_insights,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (convError) {
    console.error('[Export] Failed to get conversations:', convError);
    return [];
  }

  if (!conversations?.length) {
    return [];
  }

  // Get messages for all conversations in one query
  const conversationIds = conversations.map(c => c.id);

  const { data: messages, error: msgError } = await supabase
    .from('mirror_messages')
    .select(`
      id,
      conversation_id,
      role,
      content,
      created_at
    `)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('[Export] Failed to get messages:', msgError);
    // Return conversations without messages rather than failing
    return conversations.map(c => ({ ...c, messages: [] }));
  }

  // Group messages by conversation
  const messagesByConvo = {};
  for (const msg of (messages || [])) {
    if (!messagesByConvo[msg.conversation_id]) {
      messagesByConvo[msg.conversation_id] = [];
    }
    messagesByConvo[msg.conversation_id].push(msg);
  }

  // Attach messages to conversations
  return conversations.map(conv => ({
    ...conv,
    messages: messagesByConvo[conv.id] || []
  }));
}

/**
 * Get all entity facts for a user
 */
export async function getEntityFacts(user_id) {
  const { data, error } = await supabase
    .from('entity_facts')
    .select(`
      id,
      entity_id,
      predicate,
      object_text,
      object_entity_id,
      confidence,
      source_note_id,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get entity facts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get detected patterns
 */
export async function getPatterns(user_id) {
  const { data, error } = await supabase
    .from('user_patterns')
    .select(`
      id,
      pattern_type,
      description,
      confidence,
      evidence,
      status,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .eq('status', 'active')
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get patterns:', error);
    return [];
  }
  return data || [];
}
