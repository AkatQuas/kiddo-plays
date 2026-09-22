# TLS Certificates

For local development with `wss://`, generate a self-signed certificate:

```bash
openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt \
  -days 365 -nodes -subj "/CN=localhost"
```

Do not commit `server.key` to version control.
