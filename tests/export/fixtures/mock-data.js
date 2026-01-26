// /tests/export/fixtures/mock-data.js
// OWNER: T4
// Mock data for testing export functionality

export const mockUserId = 'test-user-00000000-0000-0000-0000-000000000001';

export const mockProfile = {
  user_id: mockUserId,
  name: 'Test User',
  role_type: 'Product Manager',
  goals: ['Ship v1', 'Get user feedback', 'Iterate quickly'],
  tone: 'warm',
  life_seasons: ['career transition', 'learning phase'],
  depth_answer: 'I am building products that help people think better.',
  custom_instructions: 'Be concise and direct. Skip unnecessary caveats.'
};

export const mockKeyPeople = [
  { name: 'Alice Chen', relationship: 'colleague', created_at: '2024-06-15T10:00:00Z' },
  { name: 'Bob Smith', relationship: 'mentor', created_at: '2024-06-20T10:00:00Z' },
  { name: 'Charlie', relationship: 'friend', created_at: '2024-07-01T10:00:00Z' }
];

export const mockEntities = [
  {
    id: 'ent-001',
    name: 'Alice Chen',
    entity_type: 'person',
    summary: 'Colleague at work, PM on the platform team',
    importance_score: 0.9,
    sentiment_average: 0.7,
    mention_count: 23,
    is_historical: false,
    privacy_level: 'internal',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2025-01-20T10:00:00Z'
  },
  {
    id: 'ent-002',
    name: 'Project Phoenix',
    entity_type: 'project',
    summary: 'Main product initiative for Q1',
    importance_score: 0.95,
    sentiment_average: 0.5,
    mention_count: 45,
    is_historical: false,
    privacy_level: 'internal',
    created_at: '2024-09-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  },
  {
    id: 'ent-003',
    name: 'Secret Project',
    entity_type: 'project',
    summary: 'Confidential work',
    importance_score: 0.8,
    sentiment_average: 0.6,
    mention_count: 5,
    is_historical: false,
    privacy_level: 'private',  // Should be EXCLUDED from export
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  },
  {
    id: 'ent-004',
    name: 'Old Company',
    entity_type: 'organization',
    summary: 'Previous employer',
    importance_score: 0.3,
    sentiment_average: 0.4,
    mention_count: 8,
    is_historical: true,  // Historical entity
    privacy_level: 'internal',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2024-12-01T10:00:00Z'
  }
];

export const mockNotes = [
  {
    id: 'note-001',
    content: 'Met with Alice about Project Phoenix roadmap. She raised concerns about the timeline.',
    note_type: 'standard',
    category: 'work',
    sentiment: -0.2,
    privacy_level: 'internal',
    created_at: '2025-01-20T14:30:00Z',
    updated_at: '2025-01-20T14:30:00Z'
  },
  {
    id: 'note-002',
    content: 'Great brainstorming session today. Feeling optimistic about the new direction.',
    note_type: 'standard',
    category: 'work',
    sentiment: 0.8,
    privacy_level: 'internal',
    created_at: '2025-01-21T10:00:00Z',
    updated_at: '2025-01-21T10:00:00Z'
  },
  {
    id: 'note-003',
    content: 'Private reflection about personal matters.',
    note_type: 'standard',
    category: 'personal',
    sentiment: 0.0,
    privacy_level: 'private',  // Should be EXCLUDED
    created_at: '2025-01-22T20:00:00Z',
    updated_at: '2025-01-22T20:00:00Z'
  }
];

export const mockPatterns = [
  {
    id: 'pat-001',
    pattern_type: 'temporal',
    description: 'You do your best deep work between 9-11pm on weeknights',
    confidence: 0.85,
    evidence: { note_ids: ['note-001', 'note-002'] },
    status: 'active',
    privacy_level: 'internal',
    created_at: '2024-10-01T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'pat-002',
    pattern_type: 'relational',
    description: 'You often discuss Project Phoenix with Alice',
    confidence: 0.9,
    evidence: { note_ids: ['note-001'] },
    status: 'active',
    privacy_level: 'internal',
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2025-01-20T10:00:00Z'
  }
];

export const mockMeetings = [
  {
    id: 'mtg-001',
    entity_id: 'ent-001',
    note_id: 'note-001',
    meeting_date: '2025-01-20',
    topics: ['roadmap', 'timeline', 'resources'],
    sentiment: -0.1,
    action_items: ['Send updated timeline', 'Schedule follow-up'],
    created_at: '2025-01-20T15:00:00Z'
  }
];

export const mockConversations = [
  {
    id: 'conv-001',
    status: 'completed',
    summary: 'Discussed project priorities and next steps',
    key_insights: ['Focus on user feedback', 'Reduce scope for v1'],
    created_at: '2025-01-19T10:00:00Z',
    updated_at: '2025-01-19T10:30:00Z'
  }
];

// Expected counts after privacy filtering
export const expectedCounts = {
  entities: 3,  // Excludes 'Secret Project' (private)
  notes: 2,     // Excludes private note
  patterns: 2,
  meetings: 1,
  conversations: 1
};
