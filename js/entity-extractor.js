/**
 * Entity Extractor - Extracts people, projects, companies, topics from notes
 * Uses Claude API via /api/extract endpoint
 */

const EntityExtractor = {
  /**
   * Extract entities from note text
   * @param {string} text - The note text to analyze
   * @param {Array} existingEntities - Existing entities to avoid duplicates
   * @returns {Object} Extracted entities
   */
  async extract(text, existingEntities = []) {
    if (!text || text.trim().length < 10) {
      return { people: [], projects: [], companies: [], topics: [] };
    }

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          existing_entities: existingEntities.map(e => e.name || e)
        })
      });

      if (!response.ok) {
        throw new Error(`Extract API error: ${response.status}`);
      }

      const data = await response.json();
      return this.processEntities(data.entities || []);
    } catch (error) {
      console.error('[EntityExtractor] API error, using fallback:', error);
      return this.fallbackExtract(text);
    }
  },

  /**
   * Process and categorize entities from API response
   */
  processEntities(entities) {
    const result = {
      people: [],
      projects: [],
      companies: [],
      topics: []
    };

    for (const entity of entities) {
      const processed = {
        name: entity.name,
        sentiment: entity.sentiment || 'neutral',
        mentions: 1,
        lastSeen: new Date().toISOString()
      };

      switch (entity.type) {
        case 'person':
          result.people.push({
            ...processed,
            relationship: entity.relationship || 'mentioned',
            context: Array.isArray(entity.context) ? entity.context : []
          });
          break;
        case 'project':
          result.projects.push({
            ...processed,
            status: entity.status || 'mentioned',
            importance: entity.importance || 'medium',
            description: entity.description || ''
          });
          break;
        case 'company':
          result.companies.push({
            ...processed,
            relationship: entity.relationship || 'mentioned'
          });
          break;
        case 'topic':
          result.topics.push({
            name: entity.name,
            depth: entity.depth || 0.5,
            mentions: 1
          });
          break;
      }
    }

    return result;
  },

  /**
   * Fallback extraction using regex patterns when API fails
   */
  fallbackExtract(text) {
    const result = {
      people: [],
      projects: [],
      companies: [],
      topics: []
    };

    // Extract capitalized names (potential people)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const commonWords = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
      'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May',
      'June', 'July', 'August', 'September', 'October', 'November', 'December',
      'Digital Twin', 'The', 'This', 'That', 'Today', 'Tomorrow'];

    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      if (!commonWords.includes(name) && !result.people.find(p => p.name === name)) {
        result.people.push({
          name,
          relationship: 'mentioned',
          sentiment: 'neutral',
          mentions: 1,
          lastSeen: new Date().toISOString(),
          context: []
        });
      }
    }

    // Extract topics from keywords
    const topicKeywords = {
      'ai': 'AI',
      'artificial intelligence': 'AI',
      'machine learning': 'Machine Learning',
      'startup': 'Startups',
      'founder': 'Entrepreneurship',
      'product': 'Product Development',
      'design': 'Design',
      'code': 'Engineering',
      'business': 'Business',
      'marketing': 'Marketing',
      'sales': 'Sales',
      'investment': 'Investment',
      'investor': 'Investment',
      'content': 'Content Creation',
      'creator': 'Creator Economy'
    };

    const lowerText = text.toLowerCase();
    for (const [keyword, topic] of Object.entries(topicKeywords)) {
      if (lowerText.includes(keyword) && !result.topics.find(t => t.name === topic)) {
        result.topics.push({
          name: topic,
          depth: 0.3,
          mentions: 1
        });
      }
    }

    return result;
  },

  /**
   * Merge new entities with existing ones (deduplication)
   */
  mergeEntities(existing, incoming) {
    const merged = { ...existing };

    for (const type of ['people', 'projects', 'companies', 'topics']) {
      if (!incoming[type]) continue;

      merged[type] = merged[type] || [];

      for (const entity of incoming[type]) {
        const existingIndex = merged[type].findIndex(e =>
          this.isSimilarName(e.name, entity.name)
        );

        if (existingIndex >= 0) {
          // Update existing entity
          merged[type][existingIndex].mentions =
            (merged[type][existingIndex].mentions || 1) + 1;
          merged[type][existingIndex].lastSeen = new Date().toISOString();

          // Merge context arrays if present (with array safety checks)
          const existingContext = Array.isArray(merged[type][existingIndex].context)
            ? merged[type][existingIndex].context : [];
          const newContext = Array.isArray(entity.context) ? entity.context : [];

          if (existingContext.length > 0 || newContext.length > 0) {
            merged[type][existingIndex].context = [
              ...new Set([...existingContext, ...newContext])
            ];
          }
        } else {
          // Add new entity
          merged[type].push(entity);
        }
      }
    }

    return merged;
  },

  /**
   * Check if two names are similar (case-insensitive, handles partial matches)
   */
  isSimilarName(name1, name2) {
    if (!name1 || !name2) return false;

    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();

    // Exact match
    if (n1 === n2) return true;

    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // First name match for people
    const parts1 = n1.split(' ');
    const parts2 = n2.split(' ');
    if (parts1[0] === parts2[0] && parts1[0].length > 2) return true;

    return false;
  },

  /**
   * Get entity statistics
   */
  getStats(entities) {
    return {
      totalPeople: entities.people?.length || 0,
      totalProjects: entities.projects?.length || 0,
      totalCompanies: entities.companies?.length || 0,
      totalTopics: entities.topics?.length || 0,
      total:
        (entities.people?.length || 0) +
        (entities.projects?.length || 0) +
        (entities.companies?.length || 0) +
        (entities.topics?.length || 0)
    };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.EntityExtractor = EntityExtractor;
}
