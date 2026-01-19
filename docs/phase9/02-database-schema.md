# Phase 9: Database Schema

## Table: user_profiles

Stores explicit user preferences from onboarding and settings.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Onboarding (required)
  name TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN (
    'BUILDING', 'LEADING', 'MAKING', 'LEARNING', 'JUGGLING', 'TRANSITIONING'
  )),
  goals TEXT[] NOT NULL DEFAULT '{}',
  
  -- Progressive (optional, unlocks after 5 notes)
  tone TEXT CHECK (tone IN ('DIRECT', 'WARM', 'CHALLENGING', 'ADAPTIVE')),
  life_context TEXT,
  boundaries TEXT[] DEFAULT '{}',
  
  -- Metadata
  onboarding_completed_at TIMESTAMPTZ,
  preferences_unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

### Role Type Values
| Value | Display | Description |
|-------|---------|-------------|
| BUILDING | Building something | founder, creator, solopreneur |
| LEADING | Leading others | manager, exec, team lead |
| MAKING | Deep in the work | specialist, maker, IC |
| LEARNING | Learning & exploring | student, career change |
| JUGGLING | Juggling multiple things | freelancer, portfolio |
| TRANSITIONING | Between chapters | transitioning, reflecting |

### Goal Values
| Value | Display |
|-------|---------|
| DECISIONS | Think through decisions |
| PROCESS | Process what happened |
| ORGANIZE | Stay on top of things |
| SELF_UNDERSTANDING | Understand myself better |
| REMEMBER | Remember what matters |
| EXPLORING | Just exploring |

---

## Table: user_key_people

People manually added by user in profile settings.

```sql
CREATE TABLE user_key_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  added_via TEXT DEFAULT 'profile', -- 'profile' or 'confirmed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_key_people_user_id ON user_key_people(user_id);
```

---

## Table: user_entities

Auto-detected entities from notes (people, projects, places, pets).

```sql
CREATE TABLE user_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Entity info
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person', 'project', 'place', 'pet', 'other'
  )),
  relationship TEXT, -- null until user confirms
  
  -- Learning data
  mention_count INTEGER DEFAULT 1,
  first_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_average DECIMAL(3,2), -- -1 to 1
  context_notes TEXT[], -- recent context snippets
  
  -- User feedback
  confirmed BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  
  UNIQUE(user_id, name)
);

CREATE INDEX idx_user_entities_user_id ON user_entities(user_id);
CREATE INDEX idx_user_entities_type ON user_entities(user_id, entity_type);
```

---

## Table: user_feedback

Records every APPROVE/REJECT/COMMENT action.

```sql
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'approve', 'reject', 'comment'
  )),
  comment_text TEXT, -- only for 'comment' type
  
  -- Context about what was rated
  insight_type TEXT, -- what type of insight was in this note
  output_section TEXT, -- which section user was rating
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_note_id ON user_feedback(note_id);
```

### Insight Types
- emotional_observation
- hidden_assumption
- action_suggestion
- pattern_recognition
- question_prompt
- reframe
- validation
- summary

---

## Table: user_learning_profile

Aggregated learning data (computed from notes + feedback).

```sql
CREATE TABLE user_learning_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vocabulary
  common_phrases TEXT[] DEFAULT '{}',
  vocabulary_style TEXT DEFAULT 'casual', -- casual, formal, mixed
  
  -- Insight preferences (JSON: {"type": count})
  approved_insight_types JSONB DEFAULT '{}',
  rejected_insight_types JSONB DEFAULT '{}',
  
  -- Action patterns
  actions_completed INTEGER DEFAULT 0,
  actions_ignored INTEGER DEFAULT 0,
  action_types_completed TEXT[] DEFAULT '{}',
  action_types_ignored TEXT[] DEFAULT '{}',
  
  -- Temporal
  preferred_times TEXT[] DEFAULT '{}',
  temporal_patterns JSONB DEFAULT '{}',
  
  -- Themes
  recurring_themes JSONB DEFAULT '{}',
  
  -- Meta
  total_notes INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_reflections INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Migration Script

Save as `supabase/migrations/YYYYMMDD_phase9_personalization.sql`:

```sql
-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all tables
-- (copy each CREATE TABLE statement above)

-- Add RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_key_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_profile ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own key people" ON user_key_people
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own entities" ON user_entities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own feedback" ON user_feedback
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own learning profile" ON user_learning_profile
  FOR ALL USING (auth.uid() = user_id);
```
