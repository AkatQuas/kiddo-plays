# Ollama 

```bash
# start up server
docker compose up
```

```bash
# login to container
docker exec -it ollama-itel-test

# pull the model
ollama pull qwen:0.5b-chat
```

```bash
# in host
# check ollama server is ready
./verify.sh

# run a single chat completion
./chat.sh
```

