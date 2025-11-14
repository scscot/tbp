#!/bin/bash

cd "$(dirname "$0")/../public/assets/images/books" || exit 1

echo "📥 Downloading book cover images..."

curl -k -sS -o "mlm-cover-us.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.png"
curl -k -sS -o "ai-gateway.png" "https://www.stephenscott.us/wp-content/uploads/2024/12/AI-Your-Gateway-to-a-Bbetter-Life-Cover-v6.png"
curl -k -sS -o "fear-and-uncertainty.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/Fear-and-Uncertainty.png"
curl -k -sS -o "mlm-cover-es.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-ES.jpg"
curl -k -sS -o "mlm-cover-br.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-BR-1.png"
curl -k -sS -o "mlm-cover-de.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-DE.jpg"
curl -k -sS -o "mlm-cover-jp.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-JP.png"
curl -k -sS -o "mlm-cover-hi.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-HI.png"
curl -k -sS -o "network-marketing-playbook.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-Kindle-3D.png"
curl -k -sS -o "beginners-guide-ai.png" "https://www.stephenscott.us/wp-content/uploads/2024/11/Paperback-Cover-Image.png"
curl -k -sS -o "stop-sabotaging.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/Stop-Sabotaging.jpg"
curl -k -sS -o "breaking-through.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/Breaking-through-Dark.jpg"
curl -k -sS -o "divine-conversations.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/Divine-Conversations.jpg"
curl -k -sS -o "thrive-within.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/Thrive-Within.jpg"
curl -k -sS -o "stoic-king.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/The-Rise-of-Marcus-Aurelius.jpg"
curl -k -sS -o "mlm-cover-us-2.jpg" "https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.jpg"

echo "✅ Downloaded $(ls -1 *.png *.jpg 2>/dev/null | wc -l) images"
ls -1h *.png *.jpg 2>/dev/null
