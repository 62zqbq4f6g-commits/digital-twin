/**
 * AGENT FORMAT
 *
 * Phase 2 - Post-RAG Architecture
 *
 * Formats user memory for AI agent consumption.
 * Compatible with MCP (Model Context Protocol) and other agent frameworks.
 *
 * OWNER: T2 (Data Layer)
 * CONSUMERS: MCP servers, external AI agents
 */

/**
 * Format context for MCP (Model Context Protocol)
 * Returns a resource that can be served via MCP
 *
 * @param {object} context - Full context from loadFullContext()
 * @param {object} options - Formatting options
 * @returns {object} MCP-compatible resource
 */
export function formatForMCP(context, options = {}) {
  const {
    resourceUri = 'inscript://memory',
    includeFull = false
  } = options;

  return {
    uri: resourceUri,
    name: `${context.identity.name || 'User'}'s Memory`,
    description: 'Complete personal memory and knowledge graph',
    mimeType: 'application/json',

    // MCP resource content
    content: {
      type: 'memory_document',
      version: '2.0.0',
      loadedAt: context.loadedAt,

      // Summary for quick reference
      summary: buildAgentSummary(context),

      // Structured data for agent tools
      identity: context.identity,

      // Key entities with facts (for entity lookup tools)
      entities: context.knowledgeGraph.entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        relationship: e.relationship,
        facts: e.facts,
        behaviors: e.userBehaviors,
        qualities: e.qualities,
        importance: e.importance
      })),

      // Relationships for graph queries
      relationships: context.knowledgeGraph.relationships,

      // Behavioral profile
      behaviors: context.procedural.behaviors,
      patterns: context.procedural.patterns,

      // Category summaries
      summaries: context.procedural.categorySummaries.reduce((acc, s) => {
        acc[s.category] = s.summary;
        return acc;
      }, {}),

      // Episode counts (actual content is E2E encrypted)
      episodeCounts: {
        notes: context.episodes.noteCount,
        conversations: context.episodes.conversationCount,
        meetings: context.episodes.meetingCount
      },

      // Full context if requested
      ...(includeFull ? { fullContext: context } : {})
    },

    // MCP metadata
    metadata: {
      tokenEstimate: estimateTokens(context),
      loadTimeMs: context.meta.totalLoadTime,
      entityCount: context.knowledgeGraph.entityCount,
      behaviorCount: context.procedural.behaviorCount,
      patternCount: context.procedural.patternCount
    }
  };
}

/**
 * Build a summary for agent consumption
 */
function buildAgentSummary(context) {
  const lines = [];

  // Identity summary
  const id = context.identity;
  if (id.name) lines.push(`Name: ${id.name}`);
  if (id.role) lines.push(`Role: ${id.role}`);
  if (id.goals?.length) lines.push(`Goals: ${id.goals.join(', ')}`);

  // Key people
  if (id.keyPeople?.length) {
    const people = id.keyPeople.map(p => `${p.name} (${p.relationship})`).join(', ');
    lines.push(`Key people: ${people}`);
  }

  // Top entities
  const topEntities = context.knowledgeGraph.entities
    .slice(0, 10)
    .map(e => e.name);
  if (topEntities.length) {
    lines.push(`Important entities: ${topEntities.join(', ')}`);
  }

  // Behavioral highlights
  const trustBehaviors = context.procedural.behaviors
    .filter(b => b.predicate === 'trusts_opinion_of')
    .slice(0, 3)
    .map(b => b.entityName);
  if (trustBehaviors.length) {
    lines.push(`Trusts: ${trustBehaviors.join(', ')}`);
  }

  // Episode summary
  lines.push(`Memory: ${context.episodes.noteCount} notes, ${context.episodes.meetingCount} meetings`);

  return lines.join('\n');
}

/**
 * Estimate tokens (rough)
 */
function estimateTokens(context) {
  const json = JSON.stringify(context);
  return Math.ceil(json.length / 4);
}

/**
 * Format as system prompt for direct LLM consumption
 * @param {object} context - Full context from loadFullContext()
 * @param {object} options - Options
 * @returns {string} System prompt text
 */
export function formatAsSystemPrompt(context, options = {}) {
  const {
    tone = 'warm',
    includeInstructions = true
  } = options;

  const sections = [];

  // Instructions header
  if (includeInstructions) {
    sections.push(`You are a personal AI assistant with complete knowledge of the user. Below is their full memory document. Use this to provide personalized, contextually aware responses. Never mention "looking up" or "checking" information - you already know everything.`);

    if (context.identity.communication?.customInstructions) {
      sections.push(`\nUser's custom instructions: ${context.identity.communication.customInstructions}`);
    }

    if (context.identity.boundaries?.length > 0) {
      sections.push(`\nTopics to avoid: ${context.identity.boundaries.join(', ')}`);
    }

    sections.push('\n---\n');
  }

  // Import document builder for the actual content
  const { buildContextDocument } = require('./document-builder.js');
  sections.push(buildContextDocument(context));

  return sections.join('\n');
}

/**
 * Format for ChatGPT Custom GPT
 * Returns a knowledge file format compatible with GPT knowledge
 */
export function formatForGPTKnowledge(context) {
  const lines = [];

  lines.push('# User Knowledge Base');
  lines.push('');
  lines.push('This file contains everything known about the user. Reference it for all personalized responses.');
  lines.push('');

  // Identity
  const id = context.identity;
  lines.push('## About the User');
  if (id.name) lines.push(`Name: ${id.name}`);
  if (id.role) lines.push(`Role: ${id.role}`);
  if (id.selfDescription) lines.push(`Self-description: ${id.selfDescription}`);
  if (id.goals?.length) lines.push(`Goals: ${id.goals.join(', ')}`);
  lines.push('');

  // Key People
  if (id.keyPeople?.length) {
    lines.push('## Important People');
    for (const person of id.keyPeople) {
      lines.push(`- ${person.name}: ${person.relationship}`);
    }
    lines.push('');
  }

  // Entities as a reference table
  lines.push('## People and Things');
  lines.push('');
  for (const entity of context.knowledgeGraph.entities.slice(0, 100)) {
    lines.push(`### ${entity.name}`);
    if (entity.type) lines.push(`Type: ${entity.type}`);
    if (entity.relationship) lines.push(`Relationship: ${entity.relationship}`);
    if (entity.summary) lines.push(`Summary: ${entity.summary}`);

    if (entity.facts?.length) {
      lines.push('Facts:');
      for (const fact of entity.facts) {
        lines.push(`- ${fact.predicate.replace(/_/g, ' ')}: ${fact.object}`);
      }
    }
    lines.push('');
  }

  // Behaviors
  if (context.procedural.behaviors.length) {
    lines.push('## How the User Relates to People');
    for (const b of context.procedural.behaviors.slice(0, 30)) {
      const predicate = b.predicate.replace(/_/g, ' ');
      lines.push(`- ${predicate}: ${b.entityName}`);
    }
    lines.push('');
  }

  // Patterns
  if (context.procedural.patterns.length) {
    lines.push('## Behavioral Patterns');
    for (const p of context.procedural.patterns.slice(0, 20)) {
      lines.push(`- ${p.description}`);
    }
    lines.push('');
  }

  // Summaries
  if (context.procedural.categorySummaries.length) {
    lines.push('## Life Area Summaries');
    for (const s of context.procedural.categorySummaries) {
      const label = s.category.replace(/_/g, ' ');
      lines.push(`\n### ${label.charAt(0).toUpperCase() + label.slice(1)}`);
      lines.push(s.summary);
    }
  }

  return lines.join('\n');
}

/**
 * Format for Claude Projects knowledge
 * Similar to GPT but optimized for Claude's context handling
 */
export function formatForClaudeProject(context) {
  // Claude handles markdown well, use document builder
  const { buildContextDocument } = require('./document-builder.js');

  const header = `<user_memory>
This document contains the complete memory of the user you are assisting.
Use this information to provide personalized, contextually aware responses.
Do not mention "checking" or "looking up" information - you already know everything here.
</user_memory>

`;

  return header + buildContextDocument(context, {
    maxEntities: 100,
    maxPatterns: 20,
    maxNotes: 50,
    maxBehaviors: 30
  });
}

export default {
  formatForMCP,
  formatAsSystemPrompt,
  formatForGPTKnowledge,
  formatForClaudeProject
};
