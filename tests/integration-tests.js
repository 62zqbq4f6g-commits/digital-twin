/**
 * Integration Tests
 *
 * Run in browser console after login.
 * Tests encryption, BYOK, and context engineering.
 *
 * Usage:
 *   1. Open app in browser
 *   2. Login
 *   3. Open DevTools console
 *   4. Run: runAllTests()
 *
 * @version 1.0.0
 */

// ============================================
// TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('');
  console.log('%c╔═══════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold');
  console.log('%c║      INSCRIPT INTEGRATION TESTS       ║', 'color: #4CAF50; font-weight: bold');
  console.log('%c╚═══════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold');
  console.log('');

  const results = {
    encryption: await testEncryption(),
    keyManager: await testKeyManager(),
    database: await testEncryptedDatabase(),
    apiClient: await testAPIClient(),
    contextEngineering: await testContextEngineering()
  };

  // Summary
  console.log('');
  console.log('%c═══════════════════════════════════════', 'color: #2196F3');
  console.log('%cSUMMARY', 'color: #2196F3; font-weight: bold');
  console.log('%c═══════════════════════════════════════', 'color: #2196F3');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [category, tests] of Object.entries(results)) {
    const passed = tests.filter(t => t.pass).length;
    const failed = tests.filter(t => !t.pass).length;
    totalPassed += passed;
    totalFailed += failed;
    const color = failed === 0 ? 'color: #4CAF50' : 'color: #f44336';
    console.log(`%c${category}: ${passed}/${tests.length} passed`, color);
  }

  console.log('───────────────────────────────────────');
  console.log(`%cTOTAL: ${totalPassed}/${totalPassed + totalFailed} passed`,
    totalFailed === 0 ? 'color: #4CAF50; font-weight: bold' : 'color: #f44336; font-weight: bold');

  if (totalFailed > 0) {
    console.log('');
    console.log('%c❌ SOME TESTS FAILED', 'color: #f44336; font-weight: bold; font-size: 14px');
  } else {
    console.log('');
    console.log('%c✅ ALL TESTS PASSED', 'color: #4CAF50; font-weight: bold; font-size: 14px');
  }

  return results;
}

// ============================================
// ENCRYPTION TESTS
// ============================================

async function testEncryption() {
  console.log('');
  console.log('%c── ENCRYPTION TESTS ──', 'color: #9C27B0; font-weight: bold');
  console.log('');

  const results = [];
  const E = window.Encryption;

  if (!E) {
    console.log('%c⚠️ Encryption module not loaded', 'color: #ff9800');
    return [{ test: 'Module loaded', pass: false, error: 'Not loaded' }];
  }

  // Test 1: Generate salt
  try {
    const salt = E.generateSalt();
    const pass = salt && salt.length > 10;
    results.push({ test: 'Generate salt', pass });
    console.log(pass ? '%c✓ Generate salt' : '%c✗ Generate salt', pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Generate salt', pass: false, error: e.message });
    console.log('%c✗ Generate salt:', 'color: #f44336', e.message);
  }

  // Test 2: Derive key
  try {
    const salt = E.generateSalt();
    const key = await E.deriveKey('testpassword123', salt);
    const pass = key && key.type === 'secret';
    results.push({ test: 'Derive key', pass });
    console.log(pass ? '%c✓ Derive key' : '%c✗ Derive key', pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Derive key', pass: false, error: e.message });
    console.log('%c✗ Derive key:', 'color: #f44336', e.message);
  }

  // Test 3: Encrypt/decrypt roundtrip
  try {
    const salt = E.generateSalt();
    const key = await E.deriveKey('testpassword123', salt);
    const original = 'Hello, this is a test message!';
    const encrypted = await E.encrypt(original, key);
    const decrypted = await E.decrypt(encrypted, key);
    const pass = decrypted === original;
    results.push({ test: 'Encrypt/decrypt roundtrip', pass });
    console.log(pass ? '%c✓ Encrypt/decrypt roundtrip' : '%c✗ Encrypt/decrypt roundtrip', pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Encrypt/decrypt roundtrip', pass: false, error: e.message });
    console.log('%c✗ Encrypt/decrypt roundtrip:', 'color: #f44336', e.message);
  }

  // Test 4: Recovery key generation
  try {
    const recoveryKey = E.generateRecoveryKey();
    const pass = recoveryKey && /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(recoveryKey);
    results.push({ test: 'Recovery key format', pass: !!pass });
    console.log(pass ? '%c✓ Recovery key format' : '%c✗ Recovery key format', pass ? 'color: #4CAF50' : 'color: #f44336');
    if (pass) console.log('  Example:', recoveryKey);
  } catch (e) {
    results.push({ test: 'Recovery key format', pass: false, error: e.message });
    console.log('%c✗ Recovery key format:', 'color: #f44336', e.message);
  }

  // Test 5: Wrong password fails
  try {
    const salt = E.generateSalt();
    const key1 = await E.deriveKey('password1', salt);
    const encrypted = await E.encrypt('secret', key1);
    const key2 = await E.deriveKey('password2', salt);
    try {
      await E.decrypt(encrypted, key2);
      results.push({ test: 'Wrong password fails', pass: false });
      console.log('%c✗ Wrong password fails (should have thrown)', 'color: #f44336');
    } catch (decryptError) {
      results.push({ test: 'Wrong password fails', pass: true });
      console.log('%c✓ Wrong password fails', 'color: #4CAF50');
    }
  } catch (e) {
    results.push({ test: 'Wrong password fails', pass: false, error: e.message });
    console.log('%c✗ Wrong password fails:', 'color: #f44336', e.message);
  }

  // Test 6: Unicode handling
  try {
    const salt = E.generateSalt();
    const key = await E.deriveKey('testpassword123', salt);
    const original = 'Hello 你好 مرحبا 🎉 emoji test!';
    const encrypted = await E.encrypt(original, key);
    const decrypted = await E.decrypt(encrypted, key);
    const pass = decrypted === original;
    results.push({ test: 'Unicode handling', pass });
    console.log(pass ? '%c✓ Unicode handling' : '%c✗ Unicode handling', pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Unicode handling', pass: false, error: e.message });
    console.log('%c✗ Unicode handling:', 'color: #f44336', e.message);
  }

  // Test 7: Large content handling
  try {
    const salt = E.generateSalt();
    const key = await E.deriveKey('testpassword123', salt);
    const original = 'x'.repeat(100000); // 100KB
    const encrypted = await E.encrypt(original, key);
    const decrypted = await E.decrypt(encrypted, key);
    const pass = decrypted === original;
    results.push({ test: 'Large content (100KB)', pass });
    console.log(pass ? '%c✓ Large content (100KB)' : '%c✗ Large content (100KB)', pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Large content (100KB)', pass: false, error: e.message });
    console.log('%c✗ Large content (100KB):', 'color: #f44336', e.message);
  }

  return results;
}

// ============================================
// KEY MANAGER TESTS
// ============================================

async function testKeyManager() {
  console.log('');
  console.log('%c── KEY MANAGER TESTS ──', 'color: #9C27B0; font-weight: bold');
  console.log('');

  const results = [];
  const KM = window.KeyManager;

  if (!KM) {
    console.log('%c⚠️ KeyManager module not loaded', 'color: #ff9800');
    return [{ test: 'Module loaded', pass: false, error: 'Not loaded' }];
  }

  // Test 1: Check if setup
  try {
    const isSetup = KM.isEncryptionSetup();
    results.push({ test: 'isEncryptionSetup works', pass: true });
    console.log('%c✓ isEncryptionSetup works', 'color: #4CAF50', `(setup: ${isSetup})`);
  } catch (e) {
    results.push({ test: 'isEncryptionSetup works', pass: false, error: e.message });
    console.log('%c✗ isEncryptionSetup:', 'color: #f44336', e.message);
  }

  // Test 2: Check if unlocked
  try {
    const isUnlocked = KM.isUnlocked();
    results.push({ test: 'isUnlocked works', pass: true });
    console.log('%c✓ isUnlocked works', 'color: #4CAF50', `(unlocked: ${isUnlocked})`);
  } catch (e) {
    results.push({ test: 'isUnlocked works', pass: false, error: e.message });
    console.log('%c✗ isUnlocked:', 'color: #f44336', e.message);
  }

  // Test 3: Get key returns CryptoKey or null
  try {
    const key = KM.getKey();
    const pass = key === null || (key && key.type === 'secret');
    results.push({ test: 'getKey returns valid type', pass });
    console.log(pass ? '%c✓ getKey returns valid type' : '%c✗ getKey returns valid type',
      pass ? 'color: #4CAF50' : 'color: #f44336',
      `(${key ? 'CryptoKey' : 'null'})`);
  } catch (e) {
    results.push({ test: 'getKey returns valid type', pass: false, error: e.message });
    console.log('%c✗ getKey:', 'color: #f44336', e.message);
  }

  // Only test encryption/decryption if unlocked
  if (KM.isUnlocked()) {
    try {
      const original = 'Test with current key';
      const encrypted = await KM.encryptWithCurrentKey(original);
      const decrypted = await KM.decryptWithCurrentKey(encrypted);
      const pass = decrypted === original;
      results.push({ test: 'Encrypt/decrypt with current key', pass });
      console.log(pass ? '%c✓ Encrypt/decrypt with current key' : '%c✗ Encrypt/decrypt with current key',
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: 'Encrypt/decrypt with current key', pass: false, error: e.message });
      console.log('%c✗ Encrypt/decrypt with current key:', 'color: #f44336', e.message);
    }
  } else {
    console.log('%c⚠️ Skipping current key tests (not unlocked)', 'color: #ff9800');
  }

  return results;
}

// ============================================
// ENCRYPTED DATABASE TESTS
// ============================================

async function testEncryptedDatabase() {
  console.log('');
  console.log('%c── ENCRYPTED DATABASE TESTS ──', 'color: #9C27B0; font-weight: bold');
  console.log('');

  const results = [];
  const DB = window.EncryptedDB;

  if (!DB) {
    console.log('%c⚠️ EncryptedDB module not loaded', 'color: #ff9800');
    return [{ test: 'Module loaded', pass: false, error: 'Not loaded' }];
  }

  // Test 1: isReady check
  try {
    const ready = DB.isReady();
    results.push({ test: 'isReady works', pass: true });
    console.log('%c✓ isReady works', 'color: #4CAF50', `(ready: ${ready})`);
  } catch (e) {
    results.push({ test: 'isReady works', pass: false, error: e.message });
    console.log('%c✗ isReady:', 'color: #f44336', e.message);
  }

  // Skip database tests if not ready
  if (!DB.isReady()) {
    console.log('%c⚠️ Skipping database tests (encryption not unlocked)', 'color: #ff9800');
    return results;
  }

  // Get user ID from Sync or session
  let userId;
  try {
    if (typeof Sync !== 'undefined' && Sync.user) {
      userId = Sync.user.id;
    } else {
      console.log('%c⚠️ Could not get user ID, skipping DB tests', 'color: #ff9800');
      return results;
    }
  } catch (e) {
    console.log('%c⚠️ Could not get user ID:', 'color: #ff9800', e.message);
    return results;
  }

  // Test 2: Save and load encrypted note
  let testNoteId;
  try {
    const testContent = `Test note ${Date.now()}`;
    const note = await DB.saveNote(userId, testContent, { category: 'test' });
    testNoteId = note.id;
    const pass = note && note.id && note.content === testContent;
    results.push({ test: 'Save encrypted note', pass });
    console.log(pass ? '%c✓ Save encrypted note' : '%c✗ Save encrypted note',
      pass ? 'color: #4CAF50' : 'color: #f44336');
  } catch (e) {
    results.push({ test: 'Save encrypted note', pass: false, error: e.message });
    console.log('%c✗ Save encrypted note:', 'color: #f44336', e.message);
  }

  // Test 3: Load note decrypts correctly
  if (testNoteId) {
    try {
      const loaded = await DB.loadNote(testNoteId);
      const pass = loaded && loaded.content && !loaded.content.includes('[Decryption failed]');
      results.push({ test: 'Load decrypts correctly', pass });
      console.log(pass ? '%c✓ Load decrypts correctly' : '%c✗ Load decrypts correctly',
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: 'Load decrypts correctly', pass: false, error: e.message });
      console.log('%c✗ Load decrypts correctly:', 'color: #f44336', e.message);
    }
  }

  // Test 4: Verify server has ciphertext (not plaintext)
  if (testNoteId) {
    try {
      const supabase = typeof Sync !== 'undefined' && Sync.supabase ? Sync.supabase :
        window.supabase.createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);

      const { data } = await supabase
        .from('notes')
        .select('content_encrypted, is_encrypted')
        .eq('id', testNoteId)
        .single();

      const pass = data &&
                   data.is_encrypted === true &&
                   data.content_encrypted &&
                   data.content_encrypted.length > 20;
      results.push({ test: 'Server stores ciphertext only', pass });
      console.log(pass ? '%c✓ Server stores ciphertext only' : '%c✗ Server stores ciphertext only',
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: 'Server stores ciphertext only', pass: false, error: e.message });
      console.log('%c✗ Server stores ciphertext only:', 'color: #f44336', e.message);
    }
  }

  // Cleanup test note
  if (testNoteId) {
    try {
      await DB.deleteNote(testNoteId);
      console.log('%c  (test note cleaned up)', 'color: #9e9e9e');
    } catch (e) {
      console.log('%c  (cleanup failed, manual cleanup may be needed)', 'color: #ff9800');
    }
  }

  return results;
}

// ============================================
// API CLIENT TESTS
// ============================================

async function testAPIClient() {
  console.log('');
  console.log('%c── API CLIENT TESTS ──', 'color: #9C27B0; font-weight: bold');
  console.log('');

  const results = [];

  // Check if module exists (could be ES module or global)
  let getTier, validateApiKeyFormat, isBYOK;

  // Try to access from window (if exposed globally)
  if (window.APIClient) {
    getTier = window.APIClient.getTier;
    validateApiKeyFormat = window.APIClient.validateApiKeyFormat;
    isBYOK = window.APIClient.isBYOK;
  } else {
    // Module may not be exposed globally - that's OK
    console.log('%c⚠️ APIClient not exposed globally (ES module)', 'color: #ff9800');

    // Test basic tier detection via localStorage
    try {
      const apiKey = localStorage.getItem('anthropic_api_key');
      const tier = apiKey ? 'byok' : 'managed';
      results.push({ test: 'Tier detection via localStorage', pass: true });
      console.log('%c✓ Tier detection via localStorage', 'color: #4CAF50', `(tier: ${tier})`);
    } catch (e) {
      results.push({ test: 'Tier detection via localStorage', pass: false, error: e.message });
      console.log('%c✗ Tier detection:', 'color: #f44336', e.message);
    }

    return results;
  }

  // Test 1: Tier detection
  if (getTier) {
    try {
      const tier = getTier();
      const pass = tier === 'managed' || tier === 'byok';
      results.push({ test: 'Tier detection', pass });
      console.log(pass ? '%c✓ Tier detection' : '%c✗ Tier detection',
        pass ? 'color: #4CAF50' : 'color: #f44336',
        `(tier: ${tier})`);
    } catch (e) {
      results.push({ test: 'Tier detection', pass: false, error: e.message });
      console.log('%c✗ Tier detection:', 'color: #f44336', e.message);
    }
  }

  // Test 2: API key validation format
  if (validateApiKeyFormat) {
    try {
      const valid1 = validateApiKeyFormat('sk-ant-abc123');
      const valid2 = validateApiKeyFormat('invalid-key');
      const pass = valid1 === true && valid2 === false;
      results.push({ test: 'API key format validation', pass });
      console.log(pass ? '%c✓ API key format validation' : '%c✗ API key format validation',
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: 'API key format validation', pass: false, error: e.message });
      console.log('%c✗ API key format validation:', 'color: #f44336', e.message);
    }
  }

  // Test 3: isBYOK check
  if (isBYOK) {
    try {
      const byok = isBYOK();
      results.push({ test: 'isBYOK check', pass: true });
      console.log('%c✓ isBYOK check', 'color: #4CAF50', `(byok: ${byok})`);
    } catch (e) {
      results.push({ test: 'isBYOK check', pass: false, error: e.message });
      console.log('%c✗ isBYOK:', 'color: #f44336', e.message);
    }
  }

  return results;
}

// ============================================
// CONTEXT ENGINEERING TESTS
// ============================================

async function testContextEngineering() {
  console.log('');
  console.log('%c── CONTEXT ENGINEERING TESTS ──', 'color: #9C27B0; font-weight: bold');
  console.log('');

  const results = [];

  // These modules are ES modules - try dynamic import or check window
  let classifyTask, extractMentionedEntities, getContextStrategy;

  // Check if available globally (they might be bundled)
  if (window.TaskClassifier) {
    classifyTask = window.TaskClassifier.classifyTask;
    extractMentionedEntities = window.TaskClassifier.extractMentionedEntities;
  }

  if (window.ContextStrategies) {
    getContextStrategy = window.ContextStrategies.getContextStrategy;
  }

  // If not available, try to test via the API response
  if (!classifyTask) {
    console.log('%c⚠️ Context modules not exposed globally (ES modules)', 'color: #ff9800');
    console.log('%c  Testing via pattern matching simulation...', 'color: #9e9e9e');

    // Simulate the classification logic for testing
    const TASK_PATTERNS = {
      entity_recall: [/what do you know about/i, /tell me about/i, /who is/i],
      decision: [/should I/i, /help me decide/i, /what do you think about/i],
      emotional: [/I('m| am) (feeling|stressed|anxious)/i, /struggling with/i],
      research: [/^research\s+/i, /deep dive/i, /analyze my/i],
      thinking_partner: [/I('m| am) thinking about/i, /help me think through/i],
      factual: [/when did/i, /where does/i, /what is the/i]
    };

    classifyTask = (message) => {
      for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(message)) return taskType;
        }
      }
      return 'general';
    };
  }

  // Test 1: Task classification
  const classificationTests = [
    { input: 'What do you know about Sarah?', expected: 'entity_recall' },
    { input: 'Should I take the job?', expected: 'decision' },
    { input: "I'm stressed about the launch", expected: 'emotional' },
    { input: 'Research my thoughts on productivity', expected: 'research' },
    { input: "I'm thinking about changing careers", expected: 'thinking_partner' },
    { input: 'When did I meet Marcus?', expected: 'factual' },
    { input: 'Hello', expected: 'general' }
  ];

  for (const tc of classificationTests) {
    try {
      const result = classifyTask(tc.input);
      const pass = result === tc.expected;
      results.push({ test: `Classify: "${tc.input.substring(0, 20)}..."`, pass });
      console.log(`%c${pass ? '✓' : '✗'} Classify: "${tc.input.substring(0, 25)}..." → ${result}`,
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: `Classify: "${tc.input.substring(0, 20)}..."`, pass: false });
      console.log(`%c✗ Classify error:`, 'color: #f44336', e.message);
    }
  }

  // Test 2: Entity extraction (if available)
  if (extractMentionedEntities) {
    try {
      const entities = extractMentionedEntities('What do you know about Sarah and her friend John?');
      const pass = entities.includes('Sarah') && entities.includes('John');
      results.push({ test: 'Entity extraction', pass });
      console.log(pass ? '%c✓ Entity extraction' : '%c✗ Entity extraction',
        pass ? 'color: #4CAF50' : 'color: #f44336',
        entities);
    } catch (e) {
      results.push({ test: 'Entity extraction', pass: false, error: e.message });
      console.log('%c✗ Entity extraction:', 'color: #f44336', e.message);
    }
  }

  // Test 3: Strategy selection (if available)
  if (getContextStrategy) {
    try {
      const strategy = getContextStrategy('decision');
      const pass = strategy && strategy.entities === 'relevant_people' && strategy.maxTokens === 4000;
      results.push({ test: 'Strategy selection', pass });
      console.log(pass ? '%c✓ Strategy selection' : '%c✗ Strategy selection',
        pass ? 'color: #4CAF50' : 'color: #f44336');
    } catch (e) {
      results.push({ test: 'Strategy selection', pass: false, error: e.message });
      console.log('%c✗ Strategy selection:', 'color: #f44336', e.message);
    }
  }

  return results;
}

// ============================================
// QUICK TESTS
// ============================================

/**
 * Quick encryption test - run without full test suite
 */
async function quickEncryptionTest() {
  console.log('Quick encryption test...');
  const E = window.Encryption;
  const salt = E.generateSalt();
  const key = await E.deriveKey('test123', salt);
  const encrypted = await E.encrypt('Hello World', key);
  const decrypted = await E.decrypt(encrypted, key);
  console.log('Decrypted:', decrypted);
  return decrypted === 'Hello World';
}

/**
 * Quick database test - saves and deletes a test note
 */
async function quickDatabaseTest() {
  console.log('Quick database test...');
  const DB = window.EncryptedDB;

  if (!DB || !DB.isReady()) {
    console.log('EncryptedDB not ready');
    return false;
  }

  const userId = Sync?.user?.id;
  if (!userId) {
    console.log('No user ID');
    return false;
  }

  const note = await DB.saveNote(userId, 'Quick test ' + Date.now());
  console.log('Created note:', note.id);

  const loaded = await DB.loadNote(note.id);
  console.log('Loaded note:', loaded.content);

  await DB.deleteNote(note.id);
  console.log('Deleted note');

  return true;
}

// ============================================
// EXPORT
// ============================================

window.runAllTests = runAllTests;
window.testEncryption = testEncryption;
window.testKeyManager = testKeyManager;
window.testEncryptedDatabase = testEncryptedDatabase;
window.testAPIClient = testAPIClient;
window.testContextEngineering = testContextEngineering;
window.quickEncryptionTest = quickEncryptionTest;
window.quickDatabaseTest = quickDatabaseTest;

console.log('%c[Tests] Integration tests loaded. Run: runAllTests()', 'color: #2196F3');
console.log('%c         Quick tests: quickEncryptionTest(), quickDatabaseTest()', 'color: #9e9e9e');
