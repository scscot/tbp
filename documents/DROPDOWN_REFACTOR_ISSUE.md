# Issue: Refactor deprecated DropdownButtonFormField value parameter

## Background

Per our localization CI unblock strategy, we temporarily demoted deprecation warnings to allow PR#4 to merge. This issue tracks the follow-up work to properly refactor the deprecated code.

**Related Commits:**
- `9a2b27d` - Temporary deprecation suppression in analysis_options.yaml
- `ca6eff4` - Added --no-fatal-warnings to CI workflow
- `49d6a80` - Added deprecation counter for tracking cleanup

## Deprecation Details

Flutter 3.33.0+ deprecated the `value` parameter in `DropdownButtonFormField`. Our codebase has **4 instances** that need refactoring:

**Files Affected:**
1. `lib/screens/admin_edit_profile_screen.dart:342` (Country dropdown)
2. `lib/screens/admin_edit_profile_screen.dart:375` (Primary language dropdown)
3. `lib/screens/update_profile_screen.dart:524` (Country dropdown)
4. `lib/screens/update_profile_screen.dart:554` (Primary language dropdown)

**Deprecation Message:**
```
'value' is deprecated and shouldn't be used. Use initialValue instead.
This feature was deprecated after v3.33.0.
```

## Tasks

- [ ] Refactor all 4 `DropdownButtonFormField` instances to use `initialValue` instead of `value`
- [ ] Test country and language dropdowns in both screens (admin and user profiles)
- [ ] Verify form state preservation and validation still work correctly
- [ ] Remove `deprecated_member_use: warning` from `analysis_options.yaml`
- [ ] Remove `--no-fatal-warnings` flag from `.github/workflows/i18n-and-strings.yml`
- [ ] Remove TODO comment from workflow file
- [ ] Verify `flutter analyze` passes with zero issues (no warnings)
- [ ] Update CI to confirm deprecation counter shows "0 deprecation warnings found ✓"

## Acceptance Criteria

- All dropdown functionality works identically to current behavior
- Zero deprecation warnings when running `flutter analyze`
- CI passes with strict analyzer settings (no suppression)
- Clean git history with descriptive commit message
- CI deprecation counter step shows zero warnings

## Implementation Notes

### Migration Pattern

**Before (deprecated):**
```dart
DropdownButtonFormField<String>(
  value: _selectedCountry,
  items: countries.map((country) => DropdownMenuItem(...)).toList(),
  onChanged: (value) => setState(() => _selectedCountry = value),
)
```

**After (correct):**
```dart
DropdownButtonFormField<String>(
  initialValue: _selectedCountry,
  items: countries.map((country) => DropdownMenuItem(...)).toList(),
  onChanged: (value) => setState(() => _selectedCountry = value),
)
```

### Testing Checklist

1. **Admin Edit Profile Screen** (`lib/screens/admin_edit_profile_screen.dart`)
   - [ ] Country dropdown displays current value on load
   - [ ] Country dropdown allows selection and saves correctly
   - [ ] Language dropdown displays current value on load
   - [ ] Language dropdown allows selection and saves correctly
   - [ ] Form validation triggers appropriately
   - [ ] Profile update saves both fields to Firestore

2. **Update Profile Screen** (`lib/screens/update_profile_screen.dart`)
   - [ ] Country dropdown displays current value on load
   - [ ] Country dropdown allows selection and saves correctly
   - [ ] Language dropdown displays current value on load
   - [ ] Language dropdown allows selection and saves correctly
   - [ ] Form validation triggers appropriately
   - [ ] Profile update saves both fields to Firestore

## Related

- PR#4: Notification & Empty State Localization
- CI workflow: `.github/workflows/i18n-and-strings.yml`
- Analyzer config: `analysis_options.yaml`

## Priority

**Medium** - Not blocking current functionality, but should be completed before next major feature work to maintain code quality standards and return to strict analyzer settings.

## Next Steps After Resolution

1. Verify CI passes with deprecation counter showing zero
2. Confirm no other deprecation warnings in codebase
3. Consider adding widget tests for dropdown forms to prevent regressions
4. Document migration pattern for team reference

---

**Created**: 2025-11-08
**Labels**: tech-debt, refactoring, flutter
**Milestone**: Post-PR#4 Cleanup
