# Dreamhost Security Headers Configuration

This document provides the exact `.htaccess` configuration needed for your Dreamhost hosting to support Joe's hardened token handoff system with proper security headers.

## Required .htaccess Rules

Add these rules to your `.htaccess` file in your Dreamhost web root directory:

```apache
# ========================================
# TBP Token Handoff Security Headers
# ========================================

# Content Security Policy - Prevents extension interference and XSS
<IfModule mod_headers.c>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://api.qrserver.com data:; connect-src 'self' https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net; base-uri 'self'; form-action 'self'; frame-ancestors 'none';"
</IfModule>

# Permissions Policy - Ensures clipboard-write permission for token handoff
<IfModule mod_headers.c>
    Header always set Permissions-Policy "clipboard-write=(self)"
</IfModule>

# ========================================
# Apple App Site Association (AASA) Configuration
# ========================================

# Serve AASA file with correct Content-Type and no caching
<Files "apple-app-site-association">
    Header set Content-Type "application/json"
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</Files>

# AASA at /.well-known/ location (primary)
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/\.well-known/apple-app-site-association$
RewriteRule ^.*$ /apple-app-site-association [L]

# AASA at root location (fallback)
RewriteCond %{REQUEST_URI} ^/apple-app-site-association$
RewriteRule ^.*$ /apple-app-site-association [L]

# ========================================
# Additional Security Headers (Recommended)
# ========================================

<IfModule mod_headers.c>
    # Prevent MIME type sniffing
    Header always set X-Content-Type-Options "nosniff"

    # Enable XSS protection
    Header always set X-XSS-Protection "1; mode=block"

    # Prevent framing (already covered in CSP but belt-and-suspenders)
    Header always set X-Frame-Options "DENY"

    # Force HTTPS
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>
```

## File Structure on Dreamhost

Your web directory should look like this:

```
public_html/                              (your web root)
├── .htaccess                            (contains the rules above)
├── apple-app-site-association           (AASA file, no .json extension)
├── index.html                           (Joe's hardened implementation)
├── claim.html                           (cross-device attribution page)
└── (other web files...)
```

## Important Notes

### CSP Configuration
- The `connect-src` directive allows requests to your Cloud Functions
- `img-src` includes `api.qrserver.com` for QR code generation (adjust if using different service)
- `unsafe-inline` is allowed only for styles, not scripts (maintains security)

### Permissions-Policy
- `clipboard-write=(self)` ensures your domain can write to clipboard
- This prevents browser extensions from interfering with token handoff

### AASA File Requirements
- Must be accessible at both `/.well-known/apple-app-site-association` and `/apple-app-site-association`
- Must serve `Content-Type: application/json`
- Should not be cached to ensure Apple gets fresh content

## Verification Commands

After uploading the `.htaccess` file, verify the headers are working:

```bash
# Check CSP header
curl -I https://teambuildpro.com/ | grep -i content-security-policy

# Check Permissions-Policy header
curl -I https://teambuildpro.com/ | grep -i permissions-policy

# Check AASA file Content-Type
curl -I https://teambuildpro.com/.well-known/apple-app-site-association | grep -i content-type

# Verify AASA content
curl -s https://teambuildpro.com/.well-known/apple-app-site-association | jq .
```

## Troubleshooting

### If headers don't appear:
1. Check that `mod_headers` is enabled in Dreamhost (should be by default)
2. Verify `.htaccess` file is in the correct web root directory
3. Test with a simple header first: `Header set X-Test "working"`

### If AASA file issues:
1. Ensure file has no `.json` extension
2. Verify the rewrite rules are working
3. Check file permissions (should be 644)

### If CSP blocks legitimate content:
1. Check browser console for CSP violations
2. Add specific domains to appropriate CSP directives
3. Use `Content-Security-Policy-Report-Only` for testing

## Cloud Functions URL

Remember to update the CSP `connect-src` if your Cloud Functions URL changes:
- Current: `https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net`
- Update this in the CSP rule if you move to a different region or project

## Testing Checklist

After implementing these headers:

- [ ] CSP header present and not breaking website functionality
- [ ] Permissions-Policy header allows clipboard writes
- [ ] AASA file serves as `application/json`
- [ ] AASA file accessible at both URLs (/.well-known/ and root)
- [ ] Joe's token handoff flow works end-to-end
- [ ] No CSP violations in browser console
- [ ] Clipboard writes work in Safari and other browsers

## Contact

These rules are based on Joe's security recommendations for production deployment of the TBP token handoff system.