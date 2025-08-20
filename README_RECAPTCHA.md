# reCAPTCHA Enterprise Assessment Request

This directory contains the necessary files to send a reCAPTCHA Enterprise assessment request.

## Files
- `request.json`: Template request body
- `scripts/send_recaptcha_assessment.sh`: Shell script to send the HTTP POST request
- `README_RECAPTCHA.md`: This documentation

## Usage

### Method 1: Using the shell script
```bash
./scripts/send_recaptcha_assessment.sh TOKEN API_KEY [USER_ACTION]
```

Example:
```bash
./scripts/send_recaptcha_assessment.sh "abc123token" "your-api-key-here" "login"
```

### Method 2: Using curl directly
```bash
curl -X POST \
  "https://recaptchaenterprise.googleapis.com/v1/projects/team-build-pro-1754320634605/assessments?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "token": "YOUR_TOKEN",
      "expectedAction": "YOUR_USER_ACTION",
      "siteKey": "6Lfwj5orAAAAADS--lFfBYWuz1b4LiQVUlOHZiyE"
    }
  }'
```

## Parameters
- **TOKEN**: The token returned from grecaptcha.enterprise.execute() call
- **API_KEY**: The API key associated with your Google Cloud project
- **USER_ACTION**: Optional. The user-initiated action specified in the grecaptcha.enterprise.execute() call

## Response
The API will return a JSON response containing the assessment results including:
- Risk score (0.0 to 1.0)
- Action name
- Token properties
- Reasons for risk assessment
