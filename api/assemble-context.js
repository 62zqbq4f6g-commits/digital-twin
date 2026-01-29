/**
 * MEM0 GAP 5: Token-Limited Context Assembly
 * Assembles context with time decay scoring within token limits
 * Key innovation: Smart truncation that preserves most important context
 */

// Rough token estimation (more accurate than char count)
function estimateTokens(text) {
  if (!text) return 0;
  // Average: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Time decay function - exponential decay over days
function calculateTimeDecay(dateString, halfLifeDays = 14) {
  if (!dateString) return 0.5; // Default for missing dates

  const date = new Date(dateString);
  const now = new Date();
  const daysSince = (now - date) / (1000 * 60 * 60 * 24);

  // Exponential decay: score = 0.5^(days/halfLife)
  // At halfLife days, score is 0.5
  // At 2*halfLife days, score is 0.25
  return Math.pow(0.5, daysSince / halfLifeDays);
}

// Calculate final score combining multiple factors
function calculateFinalScore(item, weights = {}) {
  const {
    importanceWeight = 0.3,
    recencyWeight = 0.25,
    relevanceWeight = 0.35,
    mentionWeight = 0.1
  } = weights;

  // Importance score (0-1)
  const importanceScore = item.importance_score ?? 0.5;

  // Recency score (time decay)
  const recencyScore = calculateTimeDecay(
    item.updated_at || item.last_mentioned_at || item.created_at,
    14 // 14-day half-life
  );

  // Relevance score (from retrieval)
  const relevanceScore = item.combined_score || item.retrieval_score || item.similarity || 0.5;

  // Mention frequency score (normalized)
  const mentionCount = item.mention_count || 1;
  const mentionScore = Math.min(mentionCount / 10, 1.0);

  // Weighted combination
  const finalScore =
    importanceScore * importanceWeight +
    recencyScore * recencyWeight +
    relevanceScore * relevanceWeight +
    mentionScore * mentionWeight;

  return {
    final_score: finalScore,
    components: {
      importance: importanceScore,
      recency: recencyScore,
      relevance: relevanceScore,
      mentions: mentionScore
    }
  };
}

// Format a single memory item for context
function formatMemoryItem(item) {
  const parts = [];

  // Entity name with type
  if (item.name) {
    const type = item.entity_type || item.memory_type || 'memory';
    parts.push(`[${item.name}] (${type})`);
  }

  // Summary or content
  if (item.summary) {
    parts.push(item.summary);
  }

  // Relationship info for people
  if (item.relationship) {
    parts.push(`Relationship: ${item.relationship}`);
  }

  // Recent context (last 2 notes)
  if (item.context_notes && item.context_notes.length > 0) {
    const recent = item.context_notes.slice(-2);
    parts.push(`Recent: ${recent.join('; ')}`);
  }

  // Sentiment if notable
  if (item.sentiment_average !== undefined && item.sentiment_average !== null) {
    const sentiment = item.sentiment_average > 0.3 ? 'positive' :
                      item.sentiment_average < -0.3 ? 'negative' : 'neutral';
    if (sentiment !== 'neutral') {
      parts.push(`Sentiment: ${sentiment}`);
    }
  }

  return parts.join(' | ');
}

// Format category summary for context
function formatSummary(summary) {
  return `[${summary.category.replace('_', ' ').toUpperCase()}]: ${summary.summary}`;
}

// Truncate text to fit within token limit
function truncateToTokenLimit(items, maxTokens, formatter) {
  const result = [];
  let currentTokens = 0;

  for (const item of items) {
    const formatted = formatter(item);
    const tokens = estimateTokens(formatted);

    if (currentTokens + tokens > maxTokens) {
      // Try to fit a truncated version
      const remainingTokens = maxTokens - currentTokens;
      if (remainingTokens > 50) { // Only include if we have reasonable space
        const truncated = formatted.substring(0, remainingTokens * 4 - 10) + '...';
        result.push(truncated);
      }
      break;
    }

    result.push(formatted);
    currentTokens += tokens;
  }

  return { items: result, tokens: currentTokens };
}

/**
 * Assemble context from tiered retrieval results
 */
function assembleContext(tieredResult, options = {}) {
  const {
    maxTokens = 4000,
    includeSummaries = true,
    includeEntities = true,
    includeFullResults = true,
    summaryTokenBudget = 0.3, // 30% for summaries
    entityTokenBudget = 0.4,  // 40% for top entities
    fullResultsBudget = 0.3   // 30% for specific results
  } = options;

  const context = {
    sections: [],
    total_tokens: 0,
    items_included: {
      summaries: 0,
      entities: 0,
      full_results: 0
    }
  };

  // Calculate token budgets
  const summaryBudget = Math.floor(maxTokens * summaryTokenBudget);
  const entityBudget = Math.floor(maxTokens * entityTokenBudget);
  const fullBudget = Math.floor(maxTokens * fullResultsBudget);

  // SECTION 1: Category Summaries (high-level context)
  if (includeSummaries && tieredResult.summaries?.length > 0) {
    const { items, tokens } = truncateToTokenLimit(
      tieredResult.summaries,
      summaryBudget,
      formatSummary
    );

    if (items.length > 0) {
      context.sections.push({
        type: 'summaries',
        header: 'What I know about you:',
        content: items
      });
      context.total_tokens += tokens;
      context.items_included.summaries = items.length;
    }
  }

  // SECTION 2: Top Entities (specific people/things)
  if (includeEntities && tieredResult.entities?.length > 0) {
    // Score and sort entities
    const scoredEntities = tieredResult.entities.map(entity => ({
      ...entity,
      ...calculateFinalScore(entity)
    })).sort((a, b) => b.final_score - a.final_score);

    const { items, tokens } = truncateToTokenLimit(
      scoredEntities,
      entityBudget,
      formatMemoryItem
    );

    if (items.length > 0) {
      context.sections.push({
        type: 'entities',
        header: 'People and things in your world:',
        content: items
      });
      context.total_tokens += tokens;
      context.items_included.entities = items.length;
    }
  }

  // SECTION 3: Full Retrieval Results (specific to query)
  if (includeFullResults && tieredResult.full_results?.results?.length > 0) {
    // Score and sort results
    const scoredResults = tieredResult.full_results.results.map(result => ({
      ...result,
      ...calculateFinalScore(result)
    })).sort((a, b) => b.final_score - a.final_score);

    const { items, tokens } = truncateToTokenLimit(
      scoredResults,
      fullBudget,
      formatMemoryItem
    );

    if (items.length > 0) {
      context.sections.push({
        type: 'relevant_memories',
        header: 'Relevant memories:',
        content: items
      });
      context.total_tokens += tokens;
      context.items_included.full_results = items.length;
    }
  }

  return context;
}

/**
 * Format assembled context as a single string for LLM prompt
 */
function formatContextForPrompt(assembledContext) {
  const parts = [];

  for (const section of assembledContext.sections) {
    parts.push(`## ${section.header}`);
    parts.push(section.content.join('\n'));
    parts.push(''); // Empty line between sections
  }

  return parts.join('\n').trim();
}

/**
 * Build user context string (for AI reflection prompt)
 */
function buildUserContextPrompt(assembledContext, onboardingData = null) {
  const parts = ['<user_context>'];

  // Add onboarding data if available
  if (onboardingData) {
    if (onboardingData.name) {
      parts.push(`User's name: ${onboardingData.name}`);
    }
    if (onboardingData.life_seasons?.length > 0) {
      parts.push(`Life season: ${onboardingData.life_seasons.join(', ')}`);
    }
    if (onboardingData.mental_focus?.length > 0) {
      parts.push(`Currently focused on: ${onboardingData.mental_focus.join(', ')}`);
    }
    parts.push('');
  }

  // Add memory context
  const formattedContext = formatContextForPrompt(assembledContext);
  if (formattedContext) {
    parts.push(formattedContext);
  }

  parts.push('</user_context>');

  return parts.join('\n');
}

/**
 * Quick context assembly for simple queries
 * Uses only top entities, no LLM calls
 */
function assembleQuickContext(entities, maxTokens = 2000) {
  if (!entities || entities.length === 0) {
    return { context: '', tokens: 0, items: 0 };
  }

  // Score and sort
  const scored = entities.map(e => ({
    ...e,
    ...calculateFinalScore(e)
  })).sort((a, b) => b.final_score - a.final_score);

  const { items, tokens } = truncateToTokenLimit(
    scored,
    maxTokens,
    formatMemoryItem
  );

  return {
    context: items.join('\n'),
    tokens,
    items: items.length
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check - require Bearer token to prevent API credit abuse
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { tieredResult, options = {}, onboardingData = null } = req.body;

  if (!tieredResult) {
    return res.status(400).json({ error: 'tieredResult required' });
  }

  try {
    const startTime = Date.now();

    // Assemble context
    const assembled = assembleContext(tieredResult, options);

    // Format for prompt
    const promptContext = buildUserContextPrompt(assembled, onboardingData);

    console.log('[assemble-context] Complete:', {
      sections: assembled.sections.length,
      total_tokens: assembled.total_tokens,
      items: assembled.items_included,
      processing_time_ms: Date.now() - startTime
    });

    return res.json({
      assembled,
      prompt_context: promptContext,
      total_tokens: assembled.total_tokens,
      processing_time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('[assemble-context] Handler error:', error);
    return res.status(500).json({ error: 'Context assembly failed' });
  }
}

// Export utilities
export {
  assembleContext,
  formatContextForPrompt,
  buildUserContextPrompt,
  assembleQuickContext,
  calculateFinalScore,
  calculateTimeDecay,
  estimateTokens,
  formatMemoryItem,
  formatSummary
};
