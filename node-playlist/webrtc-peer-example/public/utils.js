function trace(...args) {
  console.log((performance.now() / 1000).toFixed(3) + ': ', ...args);
}

// Creates iceServer from the url for Chrome.
function createIceServer(url, username, password) {
  var iceServer = null;
  var url_parts = url.split(':');
  if (url_parts[0].indexOf('stun') === 0) {
    // Create iceServer with stun url.
    iceServer = { url: url };
  } else if (url_parts[0].indexOf('turn') === 0) {
    // Chrome M28 & above uses below TURN format.
    iceServer = { url: url, credential: password, username: username };
  }
  return iceServer;
}

// Attach a media stream to an element.
function attachMediaStream(element, stream) {
  if (typeof element.srcObject !== 'undefined') {
    element.srcObject = stream;
  } else if (typeof element.mozSrcObject !== 'undefined') {
    element.mozSrcObject = stream;
  } else if (typeof element.src !== 'undefined') {
    element.src = window.URL.createObjectURL(stream);
  } else {
    console.log('Error attaching stream to element.');
  }
}

function reattachMediaStream(to, from) {
  to.src = from.src;
}
