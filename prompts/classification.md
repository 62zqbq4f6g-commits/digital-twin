# Classification Prompt — Personal vs Work

## Output Format
```json
{"system": "personal|work", "confidence": 0.0-1.0, "reasoning": "explanation"}
```

## Personal Keywords
family, health, gym, friend, hobby, home, feeling, weekend, vacation, mom, dad, exercise, relax, meditation, sleep, birthday, dinner, movie, relationship, kids, wife, husband, pet

## Work Keywords
velolume, meeting, client, investor, revenue, deadline, project, team, strategy, product, business, api, integration, partnership, mcp, n8n, creator, pitch, deck, trust, spv, governance, proposal, jv

## Examples

### Personal
"Need to call mom about weekend dinner" → {"system": "personal", "confidence": 0.95, "reasoning": "family keyword"}
"Feeling stressed, should try meditation" → {"system": "personal", "confidence": 0.92, "reasoning": "emotional, self-care"}
"Birthday party for Jake next Saturday" → {"system": "personal", "confidence": 0.94, "reasoning": "social event"}

### Work  
"Velolume investor meeting went well" → {"system": "work", "confidence": 0.98, "reasoning": "velolume, investor"}
"MCP integration team wants partnership" → {"system": "work", "confidence": 0.96, "reasoning": "integration, partnership"}
"Trust company proposal for JV structure" → {"system": "work", "confidence": 0.95, "reasoning": "trust, proposal, jv, structure"}

### Ambiguous → Default Personal
"Getting a new desk" → {"system": "personal", "confidence": 0.55, "reasoning": "no clear work context, default personal"}
