import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

Vue.config.productionTip = false

function onBridgeReady() {
  window.WeixinJSBridge.call('hideOptionMenu')
}

if (typeof window.WeixinJSBridge === 'undefined') {
  if (document.addEventListener) {
    document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false)
  } else if (document.attachEvent) {
    document.attachEvent('WeixinJSBridgeReady', onBridgeReady)
    document.attachEvent('onWeixinJSBridgeReady', onBridgeReady)
  }
} else {
  onBridgeReady()
}

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app')
