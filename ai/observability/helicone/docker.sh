#!/usr/bin/env bash
export YOUR_IP="10.1.100.200"
export PUBLIC_URL="http://$YOUR_IP:3000"
export JAWN_URL="http://$YOUR_IP:8585"
export S3_URL="http://$YOUR_IP:9080"

docker run -d \
  --name helicone \
  -p 3000:3000 \
  -p 8585:8585 \
  -p 9080:9080 \
  -e SITE_URL="$PUBLIC_URL" \
  -e BETTER_AUTH_URL="$PUBLIC_URL" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXT_PUBLIC_APP_URL="$PUBLIC_URL" \
  -e NEXT_PUBLIC_HELICONE_JAWN_SERVICE="$JAWN_URL" \
  -e NEXT_PUBLIC_IS_ON_PREM=true \
  -e S3_ENDPOINT="$S3_URL" \
  helicone/helicone-all-in-one:latest
