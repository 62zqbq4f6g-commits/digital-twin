# Export Feature E2E Test Checklist

**Tester:** T4
**Date:** ___________
**Build:** ___________

## Prerequisites
- [ ] Logged into Inscript with test account
- [ ] Account has: entities, notes, patterns
- [ ] At least one item marked private (to test filtering)

## UI Tests

### Settings Page
- [ ] Navigate to Settings
- [ ] Export section is visible
- [ ] "Your Data" heading displays
- [ ] Description text is readable
- [ ] "Export My Memory" button is visible
- [ ] "What's included?" expandable works

### Button Interaction
- [ ] Button has hover state (background changes)
- [ ] Button has focus state (outline visible)
- [ ] Button is keyboard accessible (Tab, Enter)
- [ ] Button disables during export
- [ ] Loading text shows ("Preparing export...")

### Export Flow
- [ ] Click Export button
- [ ] Loading state appears
- [ ] File download triggers
- [ ] Success message appears
- [ ] Button returns to normal state
- [ ] Success message auto-hides after 5s

### Error Handling
- [ ] Disconnect network, try export
- [ ] Error message appears (not just silent fail)
- [ ] Button returns to normal state
- [ ] Can retry after error

## File Tests

### File Basics
- [ ] File downloads with correct name (inscript-export-YYYY-MM-DD.json)
- [ ] File opens in text editor
- [ ] File is valid JSON (no parse errors)
- [ ] File is human-readable (pretty printed)

### File Structure
- [ ] Has `inscript_export` root object
- [ ] Has `identity` section
- [ ] Has `entities` array
- [ ] Has `episodes` object with `notes`
- [ ] Has `patterns` array
- [ ] Has `meta` section

### Data Accuracy
- [ ] Identity name matches account
- [ ] Entity count seems reasonable
- [ ] Note content is readable (decrypted)
- [ ] Patterns have descriptions
- [ ] Meta version is "1.0.0"

### Privacy
- [ ] Private entities NOT in export
- [ ] Private notes NOT in export
- [ ] Only internal/shared items present

## Cross-Browser

- [ ] Chrome (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (mobile)

## External Validation

### ChatGPT Test
- [ ] Open ChatGPT
- [ ] Upload or paste export JSON
- [ ] Ask "What do you know about me from this file?"
- [ ] ChatGPT correctly identifies user name
- [ ] ChatGPT mentions some entities

### Claude Test
- [ ] Open Claude
- [ ] Upload or paste export JSON
- [ ] Ask "Summarize what you learned about me"
- [ ] Claude correctly reads the export

## Performance

- [ ] Export completes in < 10 seconds (small account)
- [ ] Export completes in < 30 seconds (large account)
- [ ] No browser freeze during export
- [ ] File size is reasonable (< 5MB typical)

## Issues Found

| Issue | Severity | Assigned To | Status |
|-------|----------|-------------|--------|
| | | | |
| | | | |
| | | | |

## Sign-off

- [ ] All critical tests pass
- [ ] No P0 bugs open
- [ ] Ready for production

Tester Signature: _______________ Date: ___________
