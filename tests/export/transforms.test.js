// /tests/export/transforms.test.js
// OWNER: T4
// Unit tests for T2's transform functions

import {
  buildIdentity,
  transformEntity,
  transformNote,
  transformPattern,
  buildMeta
} from '../../lib/export/transforms.js';

import { filterByPrivacy } from '../../lib/export/privacy.js';

import {
  mockProfile,
  mockKeyPeople,
  mockEntities,
  mockNotes,
  mockPatterns,
  expectedCounts
} from './fixtures/mock-data.js';

describe('Transform Functions', () => {

  describe('buildIdentity', () => {
    test('builds identity with all fields', () => {
      const identity = buildIdentity(mockProfile, mockKeyPeople);

      expect(identity.name).toBe('Test User');
      expect(identity.role).toBe('Product Manager');
      expect(identity.goals).toHaveLength(3);
      expect(identity.communication.tone).toBe('warm');
      expect(identity.key_people).toHaveLength(3);
    });

    test('handles null profile gracefully', () => {
      const identity = buildIdentity(null, []);

      expect(identity.name).toBeNull();
      expect(identity.goals).toEqual([]);
      expect(identity.key_people).toEqual([]);
    });

    test('includes custom instructions', () => {
      const identity = buildIdentity(mockProfile, []);

      expect(identity.communication.custom_instructions).toContain('concise');
    });
  });

  describe('transformEntity', () => {
    test('transforms entity to export format', () => {
      const entity = transformEntity(mockEntities[0]);

      expect(entity.id).toBe('ent-001');
      expect(entity.type).toBe('person');
      expect(entity.name).toBe('Alice Chen');
      expect(entity.importance).toBe(0.9);
      expect(entity.temporal.active).toBe(true);
    });

    test('marks historical entities as inactive', () => {
      const entity = transformEntity(mockEntities[3]); // Old Company

      expect(entity.temporal.active).toBe(false);
    });

    test('maps entity types correctly', () => {
      const personEntity = transformEntity({ ...mockEntities[0], entity_type: 'person' });
      const companyEntity = transformEntity({ ...mockEntities[0], entity_type: 'company' });

      expect(personEntity.type).toBe('person');
      expect(companyEntity.type).toBe('organization');
    });
  });

  describe('transformNote', () => {
    test('transforms note to export format', () => {
      const note = transformNote(mockNotes[0]);

      expect(note.id).toBe('note-001');
      expect(note.content).toContain('Alice');
      expect(note.category).toBe('work');
      expect(note.timestamp).toBeDefined();
    });

    test('includes sentiment in extracted field', () => {
      const note = transformNote(mockNotes[0]);

      expect(note.extracted.sentiment).toBe(-0.2);
    });
  });

  describe('transformPattern', () => {
    test('transforms pattern to export format', () => {
      const pattern = transformPattern(mockPatterns[0]);

      expect(pattern.type).toBe('temporal');
      expect(pattern.description).toContain('deep work');
      expect(pattern.confidence).toBe(0.85);
      expect(pattern.evidence.first_detected).toBeDefined();
    });
  });

  describe('filterByPrivacy', () => {
    test('excludes private entities', () => {
      const filtered = filterByPrivacy(mockEntities);

      expect(filtered).toHaveLength(expectedCounts.entities);
      expect(filtered.find(e => e.name === 'Secret Project')).toBeUndefined();
    });

    test('excludes private notes', () => {
      const filtered = filterByPrivacy(mockNotes);

      expect(filtered).toHaveLength(expectedCounts.notes);
      expect(filtered.find(n => n.privacy_level === 'private')).toBeUndefined();
    });

    test('handles empty array', () => {
      const filtered = filterByPrivacy([]);

      expect(filtered).toEqual([]);
    });

    test('handles items without privacy_level', () => {
      const items = [{ id: 1 }, { id: 2, privacy_level: 'private' }];
      const filtered = filterByPrivacy(items);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe('buildMeta', () => {
    test('builds meta with correct counts', () => {
      const meta = buildMeta({
        entities: mockEntities.slice(0, 3),
        notes: mockNotes.slice(0, 2),
        patterns: mockPatterns
      });

      expect(meta.version).toBe('1.0.0');
      expect(meta.counts.entities).toBe(3);
      expect(meta.counts.notes).toBe(2);
      expect(meta.counts.patterns).toBe(2);
      expect(meta.exported_at).toBeDefined();
    });

    test('calculates date range from notes', () => {
      const meta = buildMeta({
        entities: [],
        notes: mockNotes.slice(0, 2),
        patterns: []
      });

      expect(meta.date_range.first_entry).toBeDefined();
      expect(meta.date_range.last_entry).toBeDefined();
    });
  });
});
