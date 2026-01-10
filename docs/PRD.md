# Product Requirements Document: Digital Twin Note Agent

**Version:** 1.0 | **Owner:** Rox | **Status:** Ready for Build

---

## 1. Executive Summary

### What We're Building
A voice-to-structured-data note-taking assistant that:
- Captures voice notes via Wispr
- Classifies as Personal or Work
- Extracts metadata (action items, topics, sentiment)
- **Refines into professional structured output**
- Stores in queryable System of Record

### Success Criteria
"I speak naturally, and get professional structured notes I can share with my team."

---

## 2. Problem Statement

| Current Pain | Solution |
|--------------|----------|
| Voice notes are messy | Auto-refine into structured format |
| Manual transcription cleanup | Automatic professional formatting |
| Can't share raw voice notes | Output ready for team sharing |
| No action item extraction | Auto-extract and list actions |

---

## 3. Key Features

### 3.1 Classification
- Personal vs Work based on keywords
- Confidence scoring
- Default to Personal when ambiguous

### 3.2 Extraction
- Title generation
- Topic tagging
- Action item detection
- Sentiment analysis
- People mentioned

### 3.3 Refinement (NEW)
Transform raw voice transcription into:
- **Meeting Minutes:** Structured with context, outcomes, next steps
- **Updates:** Professional format for team sharing
- **Action Lists:** Clear, assignable tasks

---

## 4. Database Schema

```json
{
  "id": "note_YYYYMMDD_HHMMSS",
  "created_at": "ISO-8601",
  "source_file": "filename",
  "raw_text": "original transcription",
  "classification": {
    "system": "personal|work",
    "confidence": 0.0-1.0,
    "reasoning": "explanation"
  },
  "extracted": {
    "title": "auto title",
    "topics": ["tags"],
    "action_items": ["tasks"],
    "sentiment": "positive|neutral|negative",
    "people": ["names"]
  },
  "refined": {
    "summary": "professional summary",
    "formatted_output": "structured text ready for sharing"
  }
}
```

---

## 5. User Stories

| ID | Title | Priority |
|----|-------|----------|
| DT-001 | Verify project structure | P0 |
| DT-002 | Create database schema | P0 |
| DT-003 | Create classification prompt | P0 |
| DT-004 | Build classifier module | P0 |
| DT-005 | Build extractor module | P0 |
| DT-006 | Build storage module | P0 |
| DT-007 | Build file watcher | P0 |
| DT-008 | Build refiner module | P0 |
| DT-009 | Build pipeline | P0 |
| DT-010 | Build query interface | P0 |
| DT-011 | Create web dashboard | P0 |

---

## 6. Roadmap

**Phase 1 (Current):** MVP pipeline with classification, extraction, refinement
**Phase 2:** Claude API for smarter refinement
**Phase 3:** Multi-modal input, calendar integration
