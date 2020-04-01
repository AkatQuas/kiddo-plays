//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    author: 'AkatQuas',
    avatar: 'https://avatars3.githubusercontent.com/u/24731539?s=460&v=4'
  },
  //事件处理函数
  onLoad: function () {

  },
  goGitHub: function (e) {
    wx.showModal({
      title: '提示',
      content: '小程序不支持直接打开外部链接，因此复制地址到剪贴板了',
      success: res => {
        wx.setClipboardData({
          data: 'https://github.com/AkatQuas',
          success: _ => {
            wx.showToast({
              title: '复制成功',
              icon: 'succes'
            })
          }
        })
      }
    })
  }
})
