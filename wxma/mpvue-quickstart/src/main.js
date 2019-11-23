import Vue from 'vue'
import App from './App'

Vue.config.productionTip = false
App.mpType = 'app'

const app = new Vue(App)
app.$mount()

export default {
  // 这个字段走 app.json
  config: {
    // 页面前带有 ^ 符号的，会被编译成首页，其他页面可以选填，我们会自动把 webpack entry 里面的入口页面加进去
    pages: [
      'pages/logs/main',
      '^pages/index/main',
      'pages/beauty/main',
      'pages/explore/main',
      'pages/search/main',
      'pages/profile/main',
    ],
    window: {
      backgroundTextStyle: 'light',
      navigationBarBackgroundColor: '#fff',
      navigationBarTitleText: '首页',
      navigationBarTextStyle: 'black'
    },
    tabBar: {
      color: '#000',
      selectedColor: '#2980b9',
      backgroundColor: '#fff',
      borderStyle: 'white',
      list: [
        {
          pagePath: "pages/index/main",
          text: "Home",
          iconPath: "static/home-off.png",
          selectedIconPath: "static/home-on.png"
        },
        {
          pagePath: "pages/explore/main",
          text: "Explore",
          iconPath: "static/editor-off.png",
          selectedIconPath: "static/editor-on.png"
        },
        {
          pagePath: "pages/search/main",
          text: "Search",
          iconPath: "static/search-off.png",
          selectedIconPath: "static/search-on.png"
        },
        {
          pagePath: "pages/profile/main",
          text: "Profile",
          iconPath: "static/profile-off.png",
          selectedIconPath: "static/profile-on.png"
        }
      ]
    }
  }
}
