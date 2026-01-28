# T3 → T4: BYOK + ONBOARDING READY

**Completed:** January 28, 2026

## Files Created

| File | Purpose |
|------|---------|
| `/js/settings-store.js` | localStorage settings management |
| `/js/api-client.js` | AI calls (BYOK direct / Managed proxy) |
| `/js/tier-manager.js` | Tier info and switching |
| `/js/onboarding-encryption.js` | Onboarding flow UI |
| `/js/privacy-indicator.js` | Header privacy badge |
| `/css/onboarding.css` | Onboarding styles |

## API

```javascript
// Tier management
import { getCurrentTier, setTierBYOK, setTierManaged } from './tier-manager.js';

// AI calls (auto-routes based on tier)
import { callAI } from './api-client.js';
const response = await callAI({ systemPrompt, messages });

// Onboarding
import { initOnboarding } from './onboarding-encryption.js';
initOnboarding(container, () => console.log('done'));

// Privacy indicator
import { renderPrivacyIndicator } from './privacy-indicator.js';
renderPrivacyIndicator(headerContainer);
```

## Tiers

| Tier | Detection | AI Route |
|------|-----------|----------|
| Managed | No API key in localStorage | POST /api/mirror |
| BYOK | Has API key | Direct to api.anthropic.com |

## Privacy Model

| Tier | Notes | AI Conversations |
|------|-------|------------------|
| Managed ($20/mo) | Encrypted (we can't read) | Pass through server (never stored) |
| BYOK ($10/mo) | Encrypted (we can't read) | Direct to Anthropic (we see nothing) |

## Design System Compliance

- Colors: Black (#000), White (#FFF), Silver (#E5E5E5)
- Border-radius: 2px max
- Font: Inter
- Touch targets: 44px minimum
- Mobile responsive (480px breakpoint)

## Dependencies

Requires from T1:
- `setupEncryption()` from `/js/key-manager.js`
- `isEncryptionSetup()` from `/js/key-manager.js`
- `isUnlocked()` from `/js/key-manager.js`

## Testing

```javascript
// Test tier switching
import { getCurrentTier, setTierBYOK, setTierManaged } from './tier-manager.js';
import { callAI, isBYOK } from './api-client.js';

// Should start as managed
console.assert(getCurrentTier() === 'managed', 'Should start as managed');
console.assert(!isBYOK(), 'Should not be BYOK');

// Test API call routing
setTierManaged();
console.log('Tier:', getCurrentTier()); // 'managed'
```

## Ready for T4 Integration

T4 can now:
1. Wire onboarding flow into app init
2. Add privacy indicator to header
3. Replace existing AI calls with `callAI()`
4. Test both tiers end-to-end
