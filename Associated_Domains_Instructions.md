# Associated Domains Configuration Instructions

## Required Xcode Configuration

To properly configure Branch integration and Universal Links, you need to add the following Associated Domains in Xcode:

### Steps:
1. Open your iOS project in Xcode
2. Select your app target (Runner)
3. Go to "Signing & Capabilities" tab
4. Find "Associated Domains" capability
5. Add these domains:

```
applinks:teambuildpro.com
applinks:teambuildpro.app.link
applinks:go.teambuildpro.com
```

## AASA File Deployment

### For teambuildpro.com:
Upload `aasa-teambuildpro.com.json` to:
```
https://teambuildpro.com/.well-known/apple-app-site-association
```

**Supported URL Patterns:**
- `https://teambuildpro.com/?ref=88888888`
- `https://teambuildpro.com/?new=88888888`
- `https://teambuildpro.com/?ref=88888888&t=1` (with dynamic content parameter)
- `https://teambuildpro.com/?new=88888888&t=1`

**Important Requirements:**
- Content-Type: `application/json`
- No redirects
- HTTPS only
- No `.json` extension in the URL

### For go.teambuildpro.com (Branch Custom Domain):
Upload `aasa-go.teambuildpro.com.json` to:
```
https://go.teambuildpro.com/.well-known/apple-app-site-association
```

## Verification Commands

Test AASA files are accessible:
```bash
curl -I https://teambuildpro.com/.well-known/apple-app-site-association
curl -I https://go.teambuildpro.com/.well-known/apple-app-site-association
```

Test Universal Link routing:
```bash
xcrun simctl openurl booted "https://teambuildpro.com/?ref=88888888&t=1"
```

## Branch Configuration Notes

- `teambuildpro.app.link` is the default Branch domain
- `go.teambuildpro.com` should be configured as a custom domain in your Branch dashboard
- Both domains need to point to your app via Universal Links