//index.js
//获取应用实例
const app = getApp()
const payload = {}

Page({
  ...payload,
  goGitHub: function (_event) {
    wx.showModal({
      title: '提示',
      content: '小程序不支持直接打开外部链接，因此复制地址到剪贴板了',
      success: _res => {
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
  },
  naviTo() {
    wx.navigateToMiniProgram({
      appId: 'appId',
      fail: (args) => {
        console.log(args)
      },
      success: (args) => {
        console.log(args)
      },
    });
  },
  jumpTodo2(){
    wx.navigateTo({
      url: '/pages/todo2/index'
    })
  },
  data: {
    height: 50,
    color: 'red',
    author: 'AkatQuas',
    avatar: 'https://avatars3.githubusercontent.com/u/24731539?s=460&v=4',
      g: {
        h: 'h',
        o: 'o'
      }

  },
  //事件处理函数
  onLoad: function () {

  },

})