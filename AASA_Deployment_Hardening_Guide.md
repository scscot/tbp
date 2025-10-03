# AASA Deployment Hardening Guide

## Overview
This guide provides comprehensive instructions for deploying Apple App Site Association (AASA) files with enhanced security and reliability for Team Build Pro's referral tracking system.

## Critical AASA Files

### 1. Primary Domain AASA (teambuildpro.com)
**File:** `aasa-teambuildpro.com.json`
```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "YXV25WMDS8.com.scott.ultimatefix",
          "YXV25WMDS8.com.scott.teambuildpro-iphone"
        ],
        "components": [
          { "/": "/", "query": { "ref": "*" } },
          { "/": "/", "query": { "new": "*" } }
        ]
      }
    ]
  }
}
```

### 2. Branch Custom Domain AASA (go.teambuildpro.com)
**File:** `aasa-go.teambuildpro.com.json`
```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "YXV25WMDS8.com.scott.ultimatefix",
          "YXV25WMDS8.com.scott.teambuildpro-iphone"
        ],
        "components": [
          { "/": "/*" }
        ]
      }
    ]
  }
}
```

## Deployment Locations

### Required Locations (Both Files)

#### Primary Location
```
https://teambuildpro.com/.well-known/apple-app-site-association
https://go.teambuildpro.com/.well-known/apple-app-site-association
```

#### Fallback Location (Recommended)
```
https://teambuildpro.com/apple-app-site-association
https://go.teambuildpro.com/apple-app-site-association
```

## Server Configuration Requirements

### 1. HTTP Headers (Critical)
```nginx
# Nginx Configuration
location ~ /\.well-known/apple-app-site-association$ {
    add_header Content-Type application/json;
    add_header Cache-Control "public, max-age=3600";
    add_header Access-Control-Allow-Origin "*";

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    # Disable compression for AASA files
    gzip off;
}

location ~ /apple-app-site-association$ {
    add_header Content-Type application/json;
    add_header Cache-Control "public, max-age=3600";
    add_header Access-Control-Allow-Origin "*";
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    gzip off;
}
```

```apache
# Apache Configuration (.htaccess)
<Files "apple-app-site-association">
    Header set Content-Type "application/json"
    Header set Cache-Control "public, max-age=3600"
    Header set Access-Control-Allow-Origin "*"
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"

    # Disable compression
    SetEnv no-gzip 1
    SetEnv no-brotli 1
</Files>
```

### 2. HTTPS Requirements
- **SSL Certificate:** Valid and current
- **Protocol:** TLS 1.2 or higher
- **Redirect Policy:** HTTP → HTTPS (301 redirect)
- **HSTS Header:** Recommended for security

```nginx
# Force HTTPS redirect
server {
    listen 80;
    server_name teambuildpro.com go.teambuildpro.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS configuration
server {
    listen 443 ssl http2;
    server_name teambuildpro.com go.teambuildpro.com;

    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

## File Size and Performance Limits

### AASA File Constraints
- **Maximum Size:** 128 KB
- **Current Size:** ~200 bytes (well within limits)
- **Compression:** Disabled (Apple requirement)
- **Response Time:** < 500ms recommended

### CDN Configuration
```yaml
# CloudFlare Configuration
Cache Rules:
  - Path: "/.well-known/apple-app-site-association"
    Cache Level: "Cache Everything"
    Edge Cache TTL: 1 hour
    Browser Cache TTL: 1 hour

  - Path: "/apple-app-site-association"
    Cache Level: "Cache Everything"
    Edge Cache TTL: 1 hour
    Browser Cache TTL: 1 hour
```

## Deployment Validation

### 1. Pre-Deployment Checks
```bash
#!/bin/bash
# AASA Validation Script

# Check JSON syntax
echo "Validating JSON syntax..."
jq . aasa-teambuildpro.com.json > /dev/null && echo "✅ Primary AASA JSON valid"
jq . aasa-go.teambuildpro.com.json > /dev/null && echo "✅ Branch AASA JSON valid"

# Check file sizes
primary_size=$(wc -c < aasa-teambuildpro.com.json)
branch_size=$(wc -c < aasa-go.teambuildpro.com.json)

echo "Primary AASA size: $primary_size bytes"
echo "Branch AASA size: $branch_size bytes"

if [ $primary_size -gt 131072 ] || [ $branch_size -gt 131072 ]; then
    echo "❌ AASA file(s) exceed 128KB limit"
    exit 1
fi

echo "✅ File sizes within limits"
```

### 2. Post-Deployment Verification
```bash
#!/bin/bash
# Post-Deployment Validation

domains=("teambuildpro.com" "go.teambuildpro.com")
paths=("/.well-known/apple-app-site-association" "/apple-app-site-association")

for domain in "${domains[@]}"; do
    for path in "${paths[@]}"; do
        echo "Testing https://$domain$path"

        # Check HTTP status
        status=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain$path")
        if [ "$status" -eq 200 ]; then
            echo "✅ Status: $status"
        else
            echo "❌ Status: $status"
        fi

        # Check Content-Type
        content_type=$(curl -s -I "https://$domain$path" | grep -i content-type | cut -d' ' -f2 | tr -d '\r')
        if [[ "$content_type" == "application/json"* ]]; then
            echo "✅ Content-Type: $content_type"
        else
            echo "❌ Content-Type: $content_type (should be application/json)"
        fi

        # Check JSON validity
        curl -s "https://$domain$path" | jq . > /dev/null
        if [ $? -eq 0 ]; then
            echo "✅ Valid JSON response"
        else
            echo "❌ Invalid JSON response"
        fi

        echo "---"
    done
done
```

### 3. Apple Validation Tools
```bash
# Apple's AASA Validator (unofficial)
curl -s "https://search.developer.apple.com/appsearch-validation-tool/" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "url=https://teambuildpro.com"

# iOS Simulator Testing
xcrun simctl openurl booted "https://teambuildpro.com/?ref=88888888&t=1"
```

## Monitoring and Alerting

### 1. Uptime Monitoring
```yaml
# StatusCake / Pingdom Configuration
Checks:
  - URL: "https://teambuildpro.com/.well-known/apple-app-site-association"
    Expected Status: 200
    Expected Content: '"applinks"'
    Check Interval: 5 minutes

  - URL: "https://go.teambuildpro.com/.well-known/apple-app-site-association"
    Expected Status: 200
    Expected Content: '"applinks"'
    Check Interval: 5 minutes
```

### 2. Content Integrity Monitoring
```bash
#!/bin/bash
# AASA Content Integrity Check (run via cron)

expected_hash_primary="$(sha256sum aasa-teambuildpro.com.json | cut -d' ' -f1)"
expected_hash_branch="$(sha256sum aasa-go.teambuildpro.com.json | cut -d' ' -f1)"

# Check primary domain
actual_hash_primary=$(curl -s "https://teambuildpro.com/.well-known/apple-app-site-association" | sha256sum | cut -d' ' -f1)
if [ "$expected_hash_primary" != "$actual_hash_primary" ]; then
    echo "❌ Primary AASA content mismatch detected!"
    # Send alert
fi

# Check branch domain
actual_hash_branch=$(curl -s "https://go.teambuildpro.com/.well-known/apple-app-site-association" | sha256sum | cut -d' ' -f1)
if [ "$expected_hash_branch" != "$actual_hash_branch" ]; then
    echo "❌ Branch AASA content mismatch detected!"
    # Send alert
fi
```

## Troubleshooting Guide

### Common Issues

#### 1. HTTP 404 Errors
**Symptoms:** AASA file not found
**Solutions:**
- Verify file upload to correct locations
- Check server configuration
- Confirm domain routing

#### 2. Wrong Content-Type
**Symptoms:** Universal Links not working
**Solutions:**
- Add `Content-Type: application/json` header
- Update server configuration
- Clear CDN cache

#### 3. JSON Syntax Errors
**Symptoms:** iOS ignores AASA file
**Solutions:**
- Validate JSON with `jq` command
- Check for trailing commas
- Verify quote escaping

#### 4. SSL Certificate Issues
**Symptoms:** AASA fetch fails
**Solutions:**
- Renew SSL certificate
- Verify certificate chain
- Test with SSL Labs

### Debug Commands

```bash
# Test AASA accessibility
curl -v https://teambuildpro.com/.well-known/apple-app-site-association

# Check HTTP headers
curl -I https://teambuildpro.com/.well-known/apple-app-site-association

# Validate JSON structure
curl -s https://teambuildpro.com/.well-known/apple-app-site-association | jq .

# Test Universal Link routing
xcrun simctl openurl booted "https://teambuildpro.com/?ref=12345678&t=1"

# Monitor iOS device logs
xcrun simctl spawn booted log stream --predicate 'eventMessage contains "AASA"'
```

## Security Considerations

### 1. Access Control
```nginx
# Limit access to AASA files (optional)
location ~ /\.well-known/apple-app-site-association$ {
    # Rate limiting
    limit_req zone=aasa burst=20 nodelay;

    # Whitelist Apple's crawlers (optional)
    # allow 17.0.0.0/8;    # Apple IP range
    # allow 192.12.74.0/24; # Apple IP range
    # deny all;
}
```

### 2. Content Security
- **File Integrity:** Use checksums to detect unauthorized changes
- **Version Control:** Track AASA file changes in git
- **Backup Strategy:** Maintain copies of working AASA files

### 3. Privacy Compliance
- **Logging:** Minimize logging of AASA requests
- **Analytics:** Exclude AASA endpoints from user tracking
- **Data Retention:** Follow GDPR/CCPA guidelines for access logs

## Rollback Procedures

### Emergency Rollback
```bash
#!/bin/bash
# Emergency AASA Rollback Script

# Backup current files
cp aasa-teambuildpro.com.json aasa-teambuildpro.com.json.backup
cp aasa-go.teambuildpro.com.json aasa-go.teambuildpro.com.json.backup

# Restore from git
git checkout HEAD~1 -- aasa-teambuildpro.com.json
git checkout HEAD~1 -- aasa-go.teambuildpro.com.json

# Redeploy
rsync -av aasa-teambuildpro.com.json server:/path/to/webroot/.well-known/apple-app-site-association
rsync -av aasa-go.teambuildpro.com.json server:/path/to/go.webroot/.well-known/apple-app-site-association

# Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://teambuildpro.com/.well-known/apple-app-site-association","https://go.teambuildpro.com/.well-known/apple-app-site-association"]}'
```

## Deployment Checklist

### Pre-Deployment
- [ ] Validate JSON syntax for both AASA files
- [ ] Confirm file sizes under 128KB
- [ ] Test query parameter matching logic
- [ ] Verify both bundle IDs are included
- [ ] Review server configuration

### Deployment
- [ ] Upload to primary locations (`.well-known/`)
- [ ] Upload to fallback locations (root)
- [ ] Configure proper HTTP headers
- [ ] Clear CDN/proxy cache
- [ ] Verify HTTPS accessibility

### Post-Deployment
- [ ] Test HTTP status codes (200)
- [ ] Verify Content-Type headers
- [ ] Validate JSON response structure
- [ ] Test Universal Link routing
- [ ] Monitor for 24 hours

### Future Bundle Addition
- [ ] Add iPhone-only bundle ID to both AASA files
- [ ] Update Associated Domains in Xcode
- [ ] Test with both bundle IDs
- [ ] Coordinate with App Store submission

---

**Critical Note:** AASA files are cached by iOS for up to 24 hours. Changes may not take effect immediately. Plan deployments accordingly and test thoroughly on physical devices.