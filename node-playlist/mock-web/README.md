# Mock Web

Start the web and server in two ports.

1. The web page at `http://localhost:8090/` will launch Native Application by invoking custom schema like `mongo://open?abc=1`

2. The Native Application would launch a node server on port `21210`. Currently we use a `server.js` to mock.

3. The key is the custom schema registration for both Windows and MacOS.

4. `client.api.js` and `client.ws.js` is just a test script for server.
