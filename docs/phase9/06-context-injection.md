# Phase 9: Context Injection

## Overview

Every analysis prompt should include relevant user context so the Twin responds in a personalized way. Context depth scales with note count.

---

## Context Levels

| Notes | Level | What's Included |
|-------|-------|-----------------|
| 1 | MINIMAL | Profile basics only |
| 2-5 | BASIC | Profile + key people + life context |
| 6-10 | GROWING | Above + entities + early feedback patterns |
| 10+ | FULL | Everything including themes, vocabulary, temporal patterns |

---

## buildUserContext Function

```javascript
async function buildUserContext(userId) {
  // Fetch all relevant data
  const [profile, learning, entities, keyPeople, feedback] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('user_learning_profile').select('*').eq('user_id', userId).single(),
    supabase.from('user_entities').select('*').eq('user_id', userId).eq('dismissed', false).order('mention_count', { ascending: false }).limit(15),
    supabase.from('user_key_people').select('*').eq('user_id', userId),
    supabase.from('user_feedback').select('insight_type, feedback_type').eq('user_id', userId)
  ]);
  
  const noteCount = learning?.total_notes || 0;
  const contextLevel = getContextLevel(noteCount);
  
  // Build context string based on level
  let context = buildMinimalContext(profile);
  
  if (contextLevel !== 'MINIMAL') {
    context += buildBasicContext(profile, keyPeople);
  }
  
  if (contextLevel === 'GROWING' || contextLevel === 'FULL') {
    context += buildGrowingContext(entities, feedback);
  }
  
  if (contextLevel === 'FULL') {
    context += buildFullContext(learning);
  }
  
  return context;
}

function getContextLevel(noteCount) {
  if (noteCount <= 1) return 'MINIMAL';
  if (noteCount <= 5) return 'BASIC';
  if (noteCount <= 10) return 'GROWING';
  return 'FULL';
}
```

---

## Context Builders

### Minimal Context (Note #1)

```javascript
function buildMinimalContext(profile) {
  if (!profile) return '';
  
  return `
USER CONTEXT:
- Name: ${profile.name}
- Mode: ${formatRoleType(profile.role_type)}
- Here to: ${formatGoals(profile.goals)}
- Tone: ${profile.tone || 'balanced (not specified)'}
`;
}

function formatRoleType(roleType) {
  const descriptions = {
    'BUILDING': 'Building something (founder/creator mindset)',
    'LEADING': 'Leading others (manager/exec)',
    'MAKING': 'Deep in the work (specialist/maker)',
    'LEARNING': 'Learning & exploring',
    'JUGGLING': 'Juggling multiple things',
    'TRANSITIONING': 'Between chapters'
  };
  return descriptions[roleType] || roleType;
}

function formatGoals(goals) {
  const labels = {
    'DECISIONS': 'think through decisions',
    'PROCESS': 'process experiences',
    'ORGANIZE': 'stay organized',
    'SELF_UNDERSTANDING': 'understand themselves better',
    'REMEMBER': 'remember what matters',
    'EXPLORING': 'explore'
  };
  return goals.map(g => labels[g] || g).join(', ');
}
```

### Basic Context (Notes 2-5)

```javascript
function buildBasicContext(profile, keyPeople) {
  let context = '';
  
  if (profile.life_context) {
    context += `
CURRENT SITUATION:
${profile.life_context}
`;
  }
  
  if (keyPeople?.length > 0) {
    context += `
KEY PEOPLE IN THEIR LIFE:
${keyPeople.map(p => `- ${p.name}: ${p.relationship}`).join('\n')}
`;
  }
  
  if (profile.boundaries?.length > 0) {
    context += `
TOPICS TO AVOID (don't probe unless they bring up):
${profile.boundaries.join(', ')}
`;
  }
  
  return context;
}
```

### Growing Context (Notes 6-10)

```javascript
function buildGrowingContext(entities, feedback) {
  let context = '';
  
  // Top entities
  const confirmedEntities = entities?.filter(e => e.confirmed || e.relationship);
  if (confirmedEntities?.length > 0) {
    context += `
PEOPLE/THINGS THEY MENTION:
${confirmedEntities.slice(0, 8).map(e => 
  `- ${e.name} (${e.entity_type}): ${e.relationship || 'relationship unknown'}, mentioned ${e.mention_count}x`
).join('\n')}
`;
  }
  
  // Feedback patterns
  const approved = feedback?.filter(f => f.feedback_type === 'approve') || [];
  const rejected = feedback?.filter(f => f.feedback_type === 'reject') || [];
  
  if (approved.length > 0 || rejected.length > 0) {
    const approvedTypes = countInsightTypes(approved);
    const rejectedTypes = countInsightTypes(rejected);
    
    context += `
WHAT RESONATES WITH THEM:
${Object.entries(approvedTypes).slice(0, 3).map(([type, count]) => `- ${type}: ${count} approvals`).join('\n') || '- Still learning'}

WHAT DOESN'T LAND:
${Object.entries(rejectedTypes).slice(0, 3).map(([type, count]) => `- ${type}: ${count} rejections`).join('\n') || '- No rejections yet'}
`;
  }
  
  return context;
}

function countInsightTypes(feedbackArray) {
  return feedbackArray.reduce((acc, f) => {
    if (f.insight_type) {
      acc[f.insight_type] = (acc[f.insight_type] || 0) + 1;
    }
    return acc;
  }, {});
}
```

### Full Context (Notes 10+)

```javascript
function buildFullContext(learning) {
  if (!learning) return '';
  
  let context = '';
  
  // Vocabulary
  if (learning.common_phrases?.length > 0) {
    context += `
THEIR VOCABULARY:
- Style: ${learning.vocabulary_style}
- Phrases they use: ${learning.common_phrases.slice(0, 5).join(', ')}
`;
  }
  
  // Temporal patterns
  if (learning.temporal_patterns && Object.keys(learning.temporal_patterns).length > 0) {
    context += `
PATTERNS NOTICED:
${Object.entries(learning.temporal_patterns).map(([pattern, confidence]) => 
  `- ${pattern} (confidence: ${Math.round(confidence * 100)}%)`
).join('\n')}
`;
  }
  
  // Recurring themes
  if (learning.recurring_themes && Object.keys(learning.recurring_themes).length > 0) {
    context += `
RECURRING THEMES:
${Object.entries(learning.recurring_themes).map(([theme, data]) => 
  `- ${theme}: mentioned ${data.count}x in past ${data.period}`
).join('\n')}
`;
  }
  
  // Action preferences
  if (learning.actions_completed > 0 || learning.actions_ignored > 0) {
    context += `
ACTION PATTERNS:
- Completed ${learning.actions_completed} suggested actions
- Ignored ${learning.actions_ignored} suggestions
- Types they act on: ${learning.action_types_completed?.join(', ') || 'various'}
- Types they skip: ${learning.action_types_ignored?.join(', ') || 'none consistently'}
`;
  }
  
  // Stats
  context += `
ENGAGEMENT:
- Total notes: ${learning.total_notes}
- Feedback given: ${learning.total_approved} approved, ${learning.total_rejected} rejected
- Reflections: ${learning.total_reflections}
`;
  
  return context;
}
```

---

## Integration with analyze.js

In your analysis API:

```javascript
// api/analyze.js

export default async function handler(req, res) {
  const { noteContent, category, userId, tier } = req.body;
  
  // Build user context
  const userContext = await buildUserContext(userId);
  
  // Build the prompt
  const prompt = `
${userContext}

---

ANALYZE THIS NOTE:
Category: ${category}
Tier: ${tier}
Content: ${noteContent}

[Rest of your existing analysis prompt...]
`;
  
  // Call Claude API with the enriched prompt
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });
  
  // ... rest of handler
}
```

---

## Tone Adaptation

Based on profile.tone, add tone guidance to prompt:

```javascript
function getToneGuidance(tone) {
  const guidance = {
    'DIRECT': `
TONE: Be direct and efficient. Get to the point. No fluff or excessive warmth.
- Short sentences
- Clear recommendations
- Skip pleasantries
`,
    'WARM': `
TONE: Be warm and supportive. Gentle encouragement.
- Acknowledge their feelings
- Use "you" frequently
- Soft language ("consider", "perhaps", "you might")
`,
    'CHALLENGING': `
TONE: Challenge them constructively. Push back. Ask hard questions.
- Question assumptions
- Don't accept surface explanations
- Be direct about contradictions
`,
    'ADAPTIVE': `
TONE: Match the energy of their note. 
- If stressed, be calming
- If excited, share enthusiasm  
- If analytical, be structured
`
  };
  
  return guidance[tone] || guidance['ADAPTIVE'];
}
```

---

## Recording Feedback for Learning

When user clicks APPROVE/REJECT:

```javascript
async function recordFeedback(noteId, feedbackType, userId, insightType) {
  // Record individual feedback
  await supabase.from('user_feedback').insert({
    user_id: userId,
    note_id: noteId,
    feedback_type: feedbackType,
    insight_type: insightType
  });
  
  // Update aggregated learning profile
  const { data: learning } = await supabase
    .from('user_learning_profile')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  const field = feedbackType === 'approve' ? 'approved_insight_types' : 'rejected_insight_types';
  const countField = feedbackType === 'approve' ? 'total_approved' : 'total_rejected';
  
  const currentTypes = learning?.[field] || {};
  currentTypes[insightType] = (currentTypes[insightType] || 0) + 1;
  
  await supabase
    .from('user_learning_profile')
    .update({
      [field]: currentTypes,
      [countField]: (learning?.[countField] || 0) + 1,
      updated_at: new Date()
    })
    .eq('user_id', userId);
}
```

---

## File Location

```
js/context.js (or api/context.js if server-side)
├── buildUserContext()
├── getContextLevel()
├── buildMinimalContext()
├── buildBasicContext()
├── buildGrowingContext()
├── buildFullContext()
├── getToneGuidance()
└── recordFeedback()
```
