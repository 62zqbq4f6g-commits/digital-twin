-- Phase 13B: MIRROR Foundation
-- Tables for MIRROR conversations and user activity signals

-- Mirror Conversations table
CREATE TABLE IF NOT EXISTS mirror_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- 'active', 'closed', 'archived'
  summary TEXT,
  key_insights JSONB,
  thread_context JSONB,
  opening_type TEXT, -- 'signal', 'continuity', 'presence', 'milestone'
  opening_signal JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mirror_conversations_user ON mirror_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_mirror_conversations_status ON mirror_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mirror_conversations_recent ON mirror_conversations(user_id, last_message_at DESC);

-- Mirror Messages table
CREATE TABLE IF NOT EXISTS mirror_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES mirror_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'inscript'
  content TEXT NOT NULL,
  message_type TEXT, -- 'prompt', 'response', 'insight', 'question'
  referenced_notes JSONB,
  referenced_entities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mirror_messages_conversation ON mirror_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mirror_messages_user ON mirror_messages(user_id);

-- User Activity Signals table (for MIRROR intelligence)
CREATE TABLE IF NOT EXISTS user_activity_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'note_created', 'entity_clicked', 'pattern_confirmed', 'note_viewed', 'reflection_feedback'
  signal_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_signals_user ON user_activity_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_signals_recent ON user_activity_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_signals_type ON user_activity_signals(user_id, signal_type, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE mirror_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for mirror_conversations
CREATE POLICY "Users can view own conversations" ON mirror_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON mirror_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON mirror_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to conversations" ON mirror_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for mirror_messages
CREATE POLICY "Users can view own messages" ON mirror_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON mirror_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to messages" ON mirror_messages
  FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for user_activity_signals
CREATE POLICY "Users can view own signals" ON user_activity_signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own signals" ON user_activity_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to signals" ON user_activity_signals
  FOR ALL USING (auth.role() = 'service_role');
