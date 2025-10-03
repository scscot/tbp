# Smart App Banner Implementation for Team Build Pro

## Overview
Smart App Banner enables seamless web-to-app transitions for iOS users, ensuring referral data is preserved when users navigate from website to installed app.

## HTML Meta Tags for Website Integration

### Primary Implementation (teambuildpro.com)

Add these meta tags to the `<head>` section of your homepage and invite pages:

```html
<!-- iOS Smart App Banner -->
<meta name="apple-itunes-app" content="app-id=6751211622">

<!-- Enhanced Smart App Banner with referral data -->
<meta name="apple-itunes-app" content="app-id=6751211622, app-argument=https://teambuildpro.com/?ref={{REFERRAL_CODE}}&t={{CONTENT_TYPE}}">
```

### Dynamic Implementation by Page Type

#### Homepage (teambuildpro.com)
```html
<!-- Static banner for homepage -->
<meta name="apple-itunes-app" content="app-id=6751211622, app-argument=https://teambuildpro.com/">
```

#### Referral Pages (teambuildpro.com/?ref=88888888)
```html
<!-- Dynamic banner with referral code -->
<meta name="apple-itunes-app" content="app-id=6751211622, app-argument=https://teambuildpro.com/?ref=88888888&t=1">
```

#### New User Pages (teambuildpro.com/?new=88888888)
```html
<!-- Dynamic banner for new user invites -->
<meta name="apple-itunes-app" content="app-id=6751211622, app-argument=https://teambuildpro.com/?new=88888888&t=2">
```

## Server-Side Template Examples

### PHP Implementation
```php
<?php
$referralCode = $_GET['ref'] ?? $_GET['new'] ?? null;
$contentType = $_GET['t'] ?? '1';
$appArgument = 'https://teambuildpro.com/';

if ($referralCode) {
    $queryType = isset($_GET['new']) ? 'new' : 'ref';
    $appArgument = "https://teambuildpro.com/?{$queryType}={$referralCode}&t={$contentType}";
}
?>

<meta name="apple-itunes-app" content="app-id=6751211622, app-argument=<?php echo htmlspecialchars($appArgument); ?>">
```

### JavaScript Implementation
```javascript
// Dynamic Smart App Banner insertion
function setupSmartAppBanner() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    const newUser = urlParams.get('new');
    const contentType = urlParams.get('t') || '1';

    let appArgument = 'https://teambuildpro.com/';

    if (ref) {
        appArgument = `https://teambuildpro.com/?ref=${ref}&t=${contentType}`;
    } else if (newUser) {
        appArgument = `https://teambuildpro.com/?new=${newUser}&t=${contentType}`;
    }

    // Create or update meta tag
    let metaTag = document.querySelector('meta[name="apple-itunes-app"]');
    if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'apple-itunes-app';
        document.head.appendChild(metaTag);
    }

    metaTag.content = `app-id=6751211622, app-argument=${appArgument}`;
}

// Call on page load
document.addEventListener('DOMContentLoaded', setupSmartAppBanner);
```

## Content Type Parameter Mapping

The `t` parameter indicates the type of content being shared:

| Value | Description | Use Case |
|-------|-------------|----------|
| `1` | Default referral | Standard partner referrals |
| `2` | New user invite | Prospect/new user invitations |
| `3` | Campaign specific | Special campaigns or promotions |
| `4` | Event invitation | Event-specific invites |

## Implementation Benefits

### For Installed Users
- **Instant app launch**: Bypasses App Store, opens app directly
- **Referral preservation**: `app-argument` passes full URL with query parameters
- **Seamless experience**: No context loss from web to app

### For Non-Installed Users
- **App Store redirect**: Shows app download page
- **Attribution ready**: Branch SDK captures deferred data after install
- **Consistent branding**: Native iOS banner appearance

## Testing Protocol

### Test Scenarios

1. **Installed App + Referral Link**
   ```
   URL: https://teambuildpro.com/?ref=88888888&t=1
   Expected: App opens with referral data intact
   ```

2. **Installed App + New User Link**
   ```
   URL: https://teambuildpro.com/?new=99999999&t=2
   Expected: App opens with new user flow
   ```

3. **Non-Installed App**
   ```
   URL: Any referral link
   Expected: Smart banner shows, redirects to App Store
   ```

### Testing Commands

```bash
# Test on iOS Safari (device/simulator)
# 1. Navigate to referral URL
# 2. Verify Smart App Banner appears
# 3. Tap banner
# 4. Confirm app opens with correct data

# Debug app-argument reception
# Check iOS logs for Universal Link processing
```

## Integration with Branch SDK

The Smart App Banner works in harmony with Branch:

1. **Immediate Deep Links**: Smart banner handles installed app scenarios
2. **Deferred Deep Links**: Branch handles App Store install scenarios
3. **Fallback Chain**: Universal Links → Smart Banner → Branch → App Store

## Security Considerations

### URL Validation
```javascript
// Validate referral codes before inserting into meta tag
function isValidReferralCode(code) {
    return /^[A-Z0-9]{8}$/.test(code); // 8-character alphanumeric
}

function sanitizeAppArgument(url) {
    try {
        const urlObj = new URL(url);
        // Only allow teambuildpro.com domain
        if (urlObj.hostname !== 'teambuildpro.com') {
            return 'https://teambuildpro.com/';
        }
        return url;
    } catch (e) {
        return 'https://teambuildpro.com/';
    }
}
```

## Deployment Checklist

- [ ] Add meta tags to homepage template
- [ ] Implement dynamic meta tag generation for referral pages
- [ ] Test with installed app on physical iOS device
- [ ] Test with non-installed app (App Store redirect)
- [ ] Verify referral data preservation in app logs
- [ ] Update analytics to track Smart Banner interactions

## Analytics Integration

```javascript
// Track Smart App Banner interactions
document.addEventListener('appinstalled', function() {
    // Track app installation from Smart Banner
    gtag('event', 'app_install', {
        'source': 'smart_app_banner',
        'referral_code': urlParams.get('ref') || urlParams.get('new')
    });
});
```

## Future Enhancements

1. **Multiple Bundle IDs**: Support iPhone-only bundle when ready
2. **Dynamic App Store Country**: Geo-specific App Store links
3. **A/B Testing**: Test different banner messaging
4. **Campaign Tracking**: Enhanced analytics for banner effectiveness

---

**Note**: Smart App Banner only works on iOS Safari. Android users will rely on Branch SDK and Intent filters for similar functionality.