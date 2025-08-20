#!/bin/bash

# Script to send reCAPTCHA Enterprise assessment request
# Usage: ./send_recaptcha_assessment.sh TOKEN API_KEY [USER_ACTION]

if [ $# -lt 2 ]; then
    echo "Usage: $0 TOKEN API_KEY [USER_ACTION]"
    echo "TOKEN: The token returned from grecaptcha.enterprise.execute() call"
    echo "API_KEY: The API key associated with the current project"
    echo "USER_ACTION: Optional. The user-initiated action specified in the grecaptcha.enterprise.execute() call"
    exit 1
fi

TOKEN=$1
API_KEY=$2
USER_ACTION=${3:-""}

# Create temporary request file with actual values
TEMP_REQUEST=$(mktemp)
cat > "$TEMP_REQUEST" << EOF
{
  "event": {
    "token": "$TOKEN",
    "expectedAction": "$USER_ACTION",
    "siteKey": "6Lfwj5orAAAAADS--lFfBYWuz1b4LiQVUlOHZiyE"
  }
}
EOF

echo "Sending reCAPTCHA Enterprise assessment request..."
echo "Token: $TOKEN"
echo "API Key: $API_KEY"
echo "User Action: $USER_ACTION"

# Send the HTTP POST request
curl -X POST \
  "https://recaptchaenterprise.googleapis.com/v1/projects/team-build-pro-1754320634605/assessments?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$TEMP_REQUEST"

# Clean up temporary file
rm -f "$TEMP_REQUEST"

echo -e "\nRequest completed."
