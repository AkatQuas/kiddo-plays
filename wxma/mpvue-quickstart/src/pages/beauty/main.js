import Vue from 'vue'
import App from './index'

const app = new Vue(App)
app.$mount()

export default {
    config: {
        "navigationBarBackgroundColor": "#ffffff",
        "navigationBarTextStyle": "black",
        "navigationBarTitleText": "拍照测颜值",
        "navigationStyle": "custom",
        "backgroundColor": "#eeeeee",
        "backgroundTextStyle": "light",
        "enablePullDownRefresh": false
    }
}