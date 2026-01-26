// /tests/export/api.test.js
// OWNER: T4
// Integration tests for T1's API endpoint

// Note: These tests require a test environment with database access
// Run with: npm test -- tests/export/api.test.js

describe('Export API', () => {

  const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;
  const API_URL = process.env.API_URL || 'http://localhost:3001';

  describe('Authentication', () => {
    test('returns 401 without auth header', async () => {
      const response = await fetch(`${API_URL}/api/export`);
      expect(response.status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      expect(response.status).toBe(401);
    });

    test('returns 200 with valid token', async () => {
      if (!TEST_USER_TOKEN) {
        console.warn('Skipping: TEST_USER_TOKEN not set');
        return;
      }

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    test('returns valid JSON', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.inscript_export).toBeDefined();
    });

    test('has correct top-level structure', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      const export_ = data.inscript_export;

      expect(export_.identity).toBeDefined();
      expect(export_.entities).toBeDefined();
      expect(export_.episodes).toBeDefined();
      expect(export_.patterns).toBeDefined();
      expect(export_.meta).toBeDefined();
    });

    test('has Content-Disposition header for download', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('inscript-export');
      expect(disposition).toContain('.json');
    });
  });

  describe('Data Integrity', () => {
    test('entities is an array', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      expect(Array.isArray(data.inscript_export.entities)).toBe(true);
    });

    test('meta has version 1.0.0', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      expect(data.inscript_export.meta.version).toBe('1.0.0');
    });

    test('meta has exported_at timestamp', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      const exportedAt = new Date(data.inscript_export.meta.exported_at);
      expect(exportedAt).toBeInstanceOf(Date);
      expect(isNaN(exportedAt)).toBe(false);
    });
  });

  describe('Privacy Filtering', () => {
    test('does not include items with privacy_level private', async () => {
      if (!TEST_USER_TOKEN) return;

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const data = await response.json();
      const export_ = data.inscript_export;

      // Check entities
      const privateEntity = export_.entities.find(e => e.privacy_level === 'private');
      expect(privateEntity).toBeUndefined();

      // Check notes
      const privateNote = export_.episodes?.notes?.find(n => n.privacy_level === 'private');
      expect(privateNote).toBeUndefined();
    });
  });

  describe('Performance', () => {
    test('responds within 10 seconds', async () => {
      if (!TEST_USER_TOKEN) return;

      const startTime = Date.now();

      const response = await fetch(`${API_URL}/api/export`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });

      const elapsed = Date.now() - startTime;
      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(10000);
    });
  });
});
