# Return to Production Website Configuration

## Overview
This document explains how to reverse the temporary changes made to `web/index.html` during the Apple App Store subscription review period and return to the full production configuration.

## Changes Made During Review Period

### 1. App Store Download Buttons - HIDDEN
**Location**: Lines 878-886 in `createAppStoreBadge()` function

**What was changed**:
```javascript
// BEFORE (Production):
<a href="${appStoreURL}" class="app-store-badge ${isPrimary ? 'primary' : 'secondary'}" target="_blank" rel="noopener">

// AFTER (Review Period):
<a href="${appStoreURL}" class="app-store-badge ${isPrimary ? 'primary' : 'secondary'}" target="_blank" rel="noopener" style="display: none;">
```

**Result**: App Store download badges are hidden but code preserved.

### 2. App Store Coming Soon Buttons - ADDED
**Location**: Lines 888-894 in `createAppStoreComingSoonButton()` function

**What was added**:
```javascript
function createAppStoreComingSoonButton(isPrimary = true) {
    return `
        <button class="android-preview-btn ${isPrimary ? 'primary' : 'secondary'}" onclick="openModal()">
            Available Soon on App Store<br>Get Notified!
        </button>
    `;
}
```

**Result**: Temporary "Coming Soon" buttons replace App Store badges.

### 3. Modal Content - UPDATED
**Location**: Lines 519-522 and 537

**What was changed**:
```html
<!-- BEFORE (Production): -->
<h2>🚀 Get Android Preview!</h2>
<p>Our app is launching soon on Google Play. Be the first to know when it's available!</p>
<div class="form-group demo-section">

<!-- AFTER (Review Period): -->
<h2>🚀 Team Build Pro Coming Soon!</h2>
<p>Our app is launching soon on both App Store and Google Play. Be the first to know when it's available!</p>
<div class="form-group demo-section" style="display: none;">
```

**Result**: Modal shows both platforms and hides demo preview option.

### 4. Success Messages - UPDATED
**Location**: Lines 1297-1299 and 1318

**What was changed**:
```javascript
// BEFORE (Production):
"We'll send you an email as soon as Team Build Pro is officially available on Google Play."

// AFTER (Review Period):
"We'll send you an email as soon as Team Build Pro is officially available on App Store and Google Play."
```

**Result**: All success messages mention both platforms.

### 5. Demo Preview Logic - DISABLED
**Location**: Lines 1140-1141 and 1417-1420

**What was changed**:
```javascript
// BEFORE (Production):
const wantDemo = demoCheckbox.checked;
const deviceType = wantDemo ? 'android' : null;

document.addEventListener('DOMContentLoaded', () => {
    setupEmailDetection();
});

// AFTER (Review Period):
const wantDemo = false; // Demo disabled during review period
const deviceType = null; // No device type during review period

// document.addEventListener('DOMContentLoaded', () => {
//     setupEmailDetection();
// });
```

**Result**: Demo preview functionality completely disabled.

### 6. Android Button Text - UPDATED
**Location**: Line 899 in `createAndroidPreviewButton()` function

**What was changed**:
```javascript
// BEFORE (Production):
Android Coming Soon<br>Request Early Access!

// AFTER (Review Period):
Available Soon on Google Play<br>Get Notified!
```

**Result**: Android button matches App Store button messaging.

### 7. Unified Button Implementation - NEW APPROACH
**Location**: Lines 888-927, 948-952, and 973-983

**What was added/changed**:
```javascript
// NEW: Unified Coming Soon Button
function createUnifiedComingSoonButton(isPrimary = true) {
    return `
        <button style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; border: 3px solid rgba(255, 255, 255, 0.3); ...">
            Coming Soon!<br>Get Notified!
        </button>
    `;
}

// CHANGED: Simplified setup functions
function setupDownloadButtons() {
    primaryContainer.innerHTML = createUnifiedComingSoonButton(true);
    secondaryContainer.innerHTML = '';
}

function setupBottomCTAs() {
    button.outerHTML = createUnifiedComingSoonButton(true);
}
```

**Result**: Single unified button replaces all platform-specific buttons across the website.

### 8. Device Selection Modal - ADDED
**Location**: Lines 536-545 in modal HTML

**What was added**:
```html
<!-- Device Selection -->
<div class="form-group">
    <label for="deviceSelection">Which device do you have?</label>
    <select id="deviceSelection" required>
        <option value="">Select your device</option>
        <option value="ios">iPhone/iPad (iOS)</option>
        <option value="android">Android Phone/Tablet</option>
        <option value="both">Both iOS and Android</option>
    </select>
</div>
```

**Result**: Users select their device preference in the modal form instead of seeing device-specific buttons.

## How to Return to Production Configuration

### Step 1: Restore App Store Download Buttons
**File**: `web/index.html`  
**Line**: 881

**Change this**:
```javascript
<a href="${appStoreURL}" class="app-store-badge ${isPrimary ? 'primary' : 'secondary'}" target="_blank" rel="noopener" style="display: none;">
```

**To this**:
```javascript
<a href="${appStoreURL}" class="app-store-badge ${isPrimary ? 'primary' : 'secondary'}" target="_blank" rel="noopener">
```

**Action**: Remove `style="display: none;"` from the App Store badge link.

### Step 2: Remove App Store Coming Soon Buttons (Optional)
**File**: `web/index.html`  
**Lines**: 888-894

**Option A - Delete the function** (clean approach):
```javascript
// DELETE THIS ENTIRE FUNCTION:
function createAppStoreComingSoonButton(isPrimary = true) {
    return `
        <button class="android-preview-btn ${isPrimary ? 'primary' : 'secondary'}" onclick="openModal()">
            App Store Coming Soon<br>Get Notified!
        </button>
    `;
}
```

**Option B - Keep for future use** (recommended):
Leave the function but it won't be called once App Store badges are restored.

### Step 3: Restore Modal Content
**File**: `web/index.html`  
**Line**: 519

**Change this**:
```html
<h2>🚀 Team Build Pro Coming Soon!</h2>
```

**To this**:
```html
<h2>🚀 Get Android Preview!</h2>
```

**Line**: 521

**Change this**:
```html
<p>Our app is launching soon on both App Store and Google Play. Be the first to know when it's available!</p>
```

**To this**:
```html
<p>Our app is launching soon on Google Play. Be the first to know when it's available!</p>
```

### Step 4: Restore Demo Preview Option
**File**: `web/index.html`  
**Line**: 537

**Change this**:
```html
<div class="form-group demo-section" style="display: none;">
```

**To this**:
```html
<div class="form-group demo-section">
```

**Action**: Remove `style="display: none;"` from the demo section.

### Step 5: Restore Demo Preview Logic
**File**: `web/index.html`  
**Lines**: 1140-1141

**Change this**:
```javascript
const wantDemo = false; // Demo disabled during review period
const deviceType = null; // No device type during review period
```

**To this**:
```javascript
const wantDemo = demoCheckbox.checked;
const deviceType = wantDemo ? 'android' : null; // Auto-set to android if demo requested
```

**Lines**: 1417-1420

**Change this**:
```javascript
// Initialize email detection when DOM is ready - DISABLED during review period
// document.addEventListener('DOMContentLoaded', () => {
//     setupEmailDetection();
// });
```

**To this**:
```javascript
// Initialize email detection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEmailDetection();
});
```

### Step 6: Restore Android Button Text
**File**: `web/index.html`  
**Line**: 899

**Change this**:
```javascript
Available Soon on Google Play<br>Get Notified!
```

**To this**:
```javascript
Android Coming Soon<br>Request Early Access!
```

### Step 7: Restore Platform-Specific Button Logic
**File**: `web/index.html`  
**Lines**: 948-952 (setupDownloadButtons) and 973-983 (setupBottomCTAs)

**Change setupDownloadButtons() from**:
```javascript
function setupDownloadButtons() {
    const primaryContainer = document.getElementById('download-container');
    const secondaryContainer = document.getElementById('secondary-container');
    
    // Use unified button for all devices
    primaryContainer.innerHTML = createUnifiedComingSoonButton(true);
    secondaryContainer.innerHTML = '';
}
```

**To this**:
```javascript
function setupDownloadButtons() {
    const device = getDeviceType();
    const primaryContainer = document.getElementById('download-container');
    const secondaryContainer = document.getElementById('secondary-container');
    
    if (device.isIOS) {
        primaryContainer.innerHTML = createAppStoreBadge(true);
        secondaryContainer.innerHTML = `
            <div style="margin-top: 0.5rem;">
                <small style="color: rgba(255, 255, 255, 0.8); margin-bottom: 0.5rem; display: block;">
                    Using Android?
                </small>
                ${createAndroidPreviewButton(false)}
            </div>
        `;
    } else if (device.isAndroid) {
        primaryContainer.innerHTML = createAndroidPreviewButton(true);
        secondaryContainer.innerHTML = `
            <div style="margin-top: 0.5rem;">
                <small style="color: rgba(255, 255, 255, 0.8); margin-bottom: 0.5rem; display: block;">
                    Have an iPhone?
                </small>
                ${createAppStoreBadge(false)}
            </div>
        `;
    } else {
        primaryContainer.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center;">
                ${createAppStoreBadge(true)}
                ${createAndroidPreviewButton(true)}
            </div>
        `;
        secondaryContainer.innerHTML = '';
    }
}
```

**Change setupBottomCTAs() from**:
```javascript
function setupBottomCTAs() {
    const ctaIds = ["cta-pricing", "cta-final"];
    
    ctaIds.forEach((id) => {
        const button = document.getElementById(id);
        if (!button) return;
        
        // Replace with unified coming soon button for all devices
        button.outerHTML = createUnifiedComingSoonButton(true);
    });
}
```

**To this**:
```javascript
function setupBottomCTAs() {
    const device = getDeviceType();
    const ctaIds = ["cta-pricing", "cta-final"];
    
    ctaIds.forEach((id) => {
        const button = document.getElementById(id);
        if (!button) return;
        
        if (device.isIOS) {
            button.outerHTML = createAppStoreBadge(true);
        } else if (device.isAndroid) {
            button.outerHTML = createAndroidPreviewButton(true);
        } else {
            button.outerHTML = `
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center;">
                    ${createAppStoreBadge(true)}
                    ${createAndroidPreviewButton(true)}
                </div>
            `;
        }
    });
}
```

### Step 8: Remove Device Selection and Restore Form Logic
**File**: `web/index.html`  
**Lines**: 536-545 (Modal HTML) and 1116-1118, 1130-1133 (Form Logic)

**Remove Device Selection HTML**:
```html
<!-- DELETE THIS ENTIRE SECTION: -->
<!-- Device Selection -->
<div class="form-group">
    <label for="deviceSelection" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333;">Which device do you have?</label>
    <select id="deviceSelection" required style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; background: white;">
        <option value="">Select your device</option>
        <option value="ios">iPhone/iPad (iOS)</option>
        <option value="android">Android Phone/Tablet</option>
        <option value="both">Both iOS and Android</option>
    </select>
</div>
```

**Restore Form Logic**:
Change lines 1116-1118 from:
```javascript
const selectedDevice = deviceSelection.value;
const wantDemo = demoCheckbox.checked;
const deviceType = selectedDevice || (wantDemo ? 'android' : null);
```

To:
```javascript
const wantDemo = demoCheckbox.checked;
const deviceType = wantDemo ? 'android' : null; // Auto-set to android if demo requested
```

**Remove Device Validation**:
Delete lines 1130-1133:
```javascript
if (!selectedDevice) {
    alert('Please select your device type.');
    return;
}
```

**Update resetModal() function**: Remove `deviceSelection` references and reset logic.

### Step 9: Restore Success Messages
**File**: `web/index.html`  
**Line**: 1298

**Change this**:
```javascript
<p>Thanks for your interest! We'll send you an email as soon as Team Build Pro is officially available on App Store and Google Play.</p>
```

**To this**:
```javascript
<p>Thanks for your interest! We'll send you an email as soon as Team Build Pro is officially available on Google Play.</p>
```

**Line**: 1318

**Change this**:
```javascript
<p style="margin: 15px 0;">We'll notify you as soon as Team Build Pro is officially available on App Store and Google Play.</p>
```

**To this**:
```javascript
<p style="margin: 15px 0;">We'll notify you as soon as Team Build Pro is officially available on Google Play.</p>
```

## Verification Steps

After making the changes above, verify the website functions correctly:

### 1. Test Device Detection
- **iOS devices**: Should see App Store download badge as primary button
- **Android devices**: Should see "Android Coming Soon" as primary button  
- **Desktop**: Should see both App Store badge and Android button

### 2. Test Modal Functionality
- Modal should show "🚀 Get Android Preview!" header
- Description should mention only Google Play
- Demo preview checkbox should be visible and functional for Gmail users

### 3. Test Success Messages
- All success messages should mention only Google Play
- Demo-related success messages should work for users who request preview access

## Summary of Files Modified

**Only one file was modified**: `/Users/sscott/tbp/web/index.html`

**Sections changed**:
1. `createAppStoreBadge()` function - App Store badges hidden
2. `createAppStoreComingSoonButton()` function - Temporary buttons added
3. Modal HTML content - Headers and descriptions updated
4. Success message functions - Text updated to mention both platforms
5. Demo section - Hidden with `style="display: none;"`

## Quick Restore Command

For a quick restoration, these are the key changes to make:

1. **Line 881**: Remove `style="display: none;"` from App Store badge
2. **Line 519**: Change "Team Build Pro Coming Soon!" to "Get Android Preview!"
3. **Line 521**: Change "both App Store and Google Play" to "Google Play"
4. **Line 537**: Remove `style="display: none;"` from demo section
5. **Lines 536-545**: Delete the entire device selection form section
6. **Line 899**: Change "Available Soon on Google Play" to "Android Coming Soon" and "Get Notified!" to "Request Early Access!"
7. **Lines 948-952**: Restore platform-specific `setupDownloadButtons()` logic
8. **Lines 973-983**: Restore platform-specific `setupBottomCTAs()` logic
9. **Lines 1116-1118**: Restore original form variable logic
10. **Lines 1130-1133**: Remove device selection validation
11. **Lines 1140-1141**: Restore demo logic variables (if not already done)
12. **Lines 1417-1420**: Uncomment email detection initialization
13. **Lines 1298 & 1318**: Change "App Store and Google Play" to "Google Play"

## Important Notes for Restoration

### Unified Button vs. Platform-Specific Approach
The current implementation uses a **unified "Coming Soon!" button** approach, which may be preferable to keep even after App Store approval due to its:
- Cleaner user experience
- Better device selection in modal
- Simplified maintenance

**Consider keeping the unified approach** and only making these changes:
- Restore App Store badges functionality (Step 1)
- Update modal content for Google Play focus (Steps 2-4)
- Keep the unified button and device selection modal

After these changes, the website will return to its production configuration with full App Store integration and Android preview functionality.