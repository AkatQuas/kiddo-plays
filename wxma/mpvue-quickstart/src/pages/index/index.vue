<template>
  <div class="container" @click="clickHandle('test click', $event)">

    <div class="userinfo" @click="bindViewTap">
      <img class="userinfo-avatar" v-if="userInfo.avatarUrl" :src="userInfo.avatarUrl" background-size="cover" />
      <div class="userinfo-nickname">
        <card :text="userInfo.nickName"></card>
      </div>
    </div>

    <block v-for="item in links" :key="item.url">
      <div @click.stop="goLink(item.url)" class="link">{{item.label}}</div>
    </block>
  </div>
</template>

<script>
import card from "@/components/card";

export default {
  data() {
    return {
      userInfo: {},
      links: [
        {
          url: "/pages/logs/main",
          label: "前往日志页面"
        },
        {
          url: "/pages/bind2way/main",
          label: "前往数据双向绑定页面"
        },
        {
          url: "/pages/counter/main",
          label: "前往Vuex示例页面"
        },
        {
          url: "/pages/beauty/main",
          label: "前往beauty页面"
        },
      ]
    };
  },

  components: {
    card
  },

  methods: {
    goLink(url) {
      wx.navigateTo({ url });
    },
    getUserInfo() {
      // 调用登录接口
      wx.login({
        success: () => {
          wx.getUserInfo({
            success: res => {
              this.userInfo = res.userInfo;
            }
          });
        }
      });
    },
    clickHandle(msg, ev) {
      console.log("clickHandle:", msg, ev);
    }
  },

  created() {
    // 调用应用实例的方法获取全局数据
    this.getUserInfo();
  }
};
</script>

<style scoped>
.userinfo {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.userinfo-avatar {
  width: 128rpx;
  height: 128rpx;
  margin: 20rpx;
  border-radius: 50%;
}

.userinfo-nickname {
  color: #aaa;
}

.link {
  display: block;
  width: 80%;
  margin: 10px auto;
  padding: 5px 10px;
  text-align: center;
  color: blue;
  border: 1px solid blue;
}
</style>
