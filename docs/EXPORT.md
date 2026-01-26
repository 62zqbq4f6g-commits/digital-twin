# Exporting Your Inscript Data

**Version:** 1.0.0
**Last Updated:** January 26, 2026

---

## Overview

Your data belongs to you. Inscript makes it easy to export everything you've captured — your notes, entities, patterns, and insights — in a portable format that works with other AI assistants.

---

## How to Export

1. Open **Settings** (gear icon in the top right)
2. Scroll to the **Your Data** section
3. Click **Export My Memory**
4. Your file will download automatically

That's it. No confirmation dialogs, no waiting for an email. Your data downloads immediately.

---

## What's Included

Your export contains everything Inscript has learned about you:

| Section | What It Contains |
|---------|------------------|
| **Identity** | Your name, role, goals, life seasons, communication preferences, and key people |
| **Entities** | People, projects, places, and things extracted from your notes — with importance scores and sentiment |
| **Notes** | All your captured moments, with AI reflections, categories, and timestamps |
| **Patterns** | Behavioral and emotional patterns Inscript has detected |
| **Metadata** | Export date, version, and counts for verification |

### What's NOT Included

- **Private items**: Anything you marked as "private" stays private and is excluded
- **Raw embeddings**: Vector data isn't portable between AI systems, so we exclude it (your content is preserved and can be re-embedded by any AI)
- **System data**: Authentication tokens, internal IDs, and technical metadata

---

## File Format

Your export is a single JSON file named:

```
inscript-export-YYYY-MM-DD.json
```

The file is human-readable (pretty-printed) and follows the PAMP (Portable AI Memory Protocol) format, designed for interoperability with other AI assistants.

### Example Structure

```json
{
  "inscript_export": {
    "identity": {
      "name": "Your Name",
      "role": "Your Role",
      "goals": ["Goal 1", "Goal 2"],
      "key_people": [
        { "name": "Marcus", "relationship": "close friend" },
        { "name": "Seri", "relationship": "dog" }
      ],
      "communication": {
        "tone": "warm",
        "custom_instructions": "Be direct and skip caveats"
      }
    },
    "entities": [
      {
        "id": "ent-abc123",
        "type": "person",
        "name": "Alice Chen",
        "summary": "Colleague on the platform team",
        "importance": 0.85,
        "sentiment": { "average": 0.7, "trend": "stable" },
        "temporal": { "first_mention": "2024-06-15", "active": true }
      }
    ],
    "episodes": {
      "notes": [
        {
          "id": "note-xyz789",
          "content": "Your original note content...",
          "reflection": "AI reflection on this note...",
          "category": "work",
          "timestamp": "2025-01-20T14:30:00Z"
        }
      ]
    },
    "patterns": [
      {
        "type": "behavioral",
        "description": "You do your best deep work between 9-11pm",
        "confidence": 0.85,
        "evidence": { "first_detected": "2024-10-01" }
      }
    ],
    "meta": {
      "version": "1.0.0",
      "exported_at": "2025-01-26T10:00:00Z",
      "counts": {
        "entities": 47,
        "notes": 234,
        "patterns": 8
      }
    }
  }
}
```

---

## Using Your Export

### With ChatGPT

1. Open ChatGPT
2. Upload your export file or paste its contents
3. Try prompts like:
   - "What do you know about me from this file?"
   - "Who are the key people in my life?"
   - "What patterns have been detected about my work habits?"

### With Claude

1. Open Claude
2. Upload your export file
3. Try prompts like:
   - "Summarize what you learned about me"
   - "What projects am I currently working on?"
   - "What are my goals?"

### With Other AI Assistants

The PAMP format is designed for broad compatibility. Any AI that can read JSON can understand your export. Share the file and ask the AI to analyze your:
- Professional context
- Key relationships
- Behavioral patterns
- Goals and priorities

---

## Privacy & Security

### What We Protect

- **Private items are excluded**: If you marked something as "private" in Inscript, it won't appear in your export
- **No credentials**: Authentication data, API keys, and passwords are never included
- **Your file, your choice**: We don't store or transmit your export — it goes directly to your device

### Recommendations

- Store your export securely (it contains personal information)
- Don't share your raw export publicly
- Review the contents before sharing with third parties

---

## Troubleshooting

### Export takes too long

For accounts with thousands of notes, export may take up to 30 seconds. If it seems stuck:
1. Check your internet connection
2. Try refreshing the page and exporting again
3. Try during off-peak hours

### File won't open

- Make sure you're opening with a text editor or JSON viewer
- Try online tools like [jsonviewer.stack.hu](https://jsonviewer.stack.hu)
- The file should be valid JSON — if it's corrupted, try exporting again

### Missing data

- **Private items** are intentionally excluded
- **Very recent notes** (last few seconds) may not appear — wait a moment and re-export
- If data is missing that should be there, contact support

### Error message appears

If you see an error during export:
1. Check your internet connection
2. Try again in a few minutes
3. If the problem persists, contact support with the error message

---

## Technical Details

### File Size

Typical export sizes:
- Small account (< 100 notes): ~50KB
- Medium account (100-1000 notes): ~500KB
- Large account (1000+ notes): 1-5MB

### Performance

- Small accounts: < 5 seconds
- Medium accounts: 5-15 seconds
- Large accounts: 15-30 seconds

### Format Version

Current export format: **1.0.0**

We'll maintain backwards compatibility as the format evolves. Future versions will remain readable by any tool that supports 1.0.0.

---

## Frequently Asked Questions

**Q: How often can I export?**
A: As often as you like. There are no limits.

**Q: Will exporting delete my data?**
A: No. Export creates a copy. Your data remains in Inscript.

**Q: Can I import data back into Inscript?**
A: Import functionality is coming soon.

**Q: Is the export encrypted?**
A: The downloaded file is plain JSON (readable text). Your data in Inscript is encrypted; the export decrypts it for portability.

**Q: Can I edit the export file?**
A: Yes, it's your data. However, edited files may not import correctly when that feature launches.

---

## Support

If you have questions about exporting your data:
- Email: support@inscript.ai
- Documentation: https://docs.inscript.ai

---

*Your memory. Your data. Your choice.*
