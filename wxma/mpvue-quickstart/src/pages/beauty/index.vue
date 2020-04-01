<template>
  <div class="beauty-wrapper">
    <image class="image" src="/static/download.jpeg" mode="aspectFill" />

    <div class="info" v-if="result">
      <div class="item"> Gender：{{ result.gender > 50 ? '♂' : '♀'}} </div>
      <div class="item"> age：{{result.age}}</div>
      <div class="item">
        Emotion：
        <span v-if="result.expression < 10">黯然伤神</span>
        <span v-else-if="result.expression < 20">半嗔半喜</span>
        <span v-else-if="result.expression < 30">似笑非笑</span>
        <span v-else-if="result.expression < 40">笑逐颜开</span>
        <span v-else-if="result.expression < 50">莞尔一笑</span>
        <span v-else-if="result.expression < 60">喜上眉梢</span>
        <span v-else-if="result.expression < 70">眉开眼笑</span>
        <span v-else-if="result.expression < 80">笑尽妖娆</span>
        <span v-else-if="result.expression < 90">心花怒放</span>
        <span v-else>一笑倾城</span>
      </div>
      <div class="item"> beauty: {{result.beauty}} (0-100)</div>
      <div v-if="result.glass">You nerd glasses!</div>
    </div>
    <div v-if="image">
      <image :src="image" />
    </div>
    <div class="controls">
      <button class="btn-start" @click="handleCamera" @dblclick="handleChoose">
        <div class="icon"></div>
        <div class="text">Take a Picture</div>
      </button>
    </div>
   
  </div>
</template>

<script>
export default {
  data: {
    bg: "",
    result: "",
    image: ""
  },
  computed: {},
  methods: {
    analyzeImage(src) {
      wx.showLoading({
        title: "Analyzing"
      });

// actually the uploading code is dead
      wx.uploadFile({
        url: "https://api.ai.qq.com/fcgi-bin/face/face_detectface",
        filePath: src,
        name: "image_file",
        success: res => {
          const result = JSON.parse(res);
          if (result.ret !== 0) {
            wx.showToast({ icon: "none", title: "Where is YOUR FACE ?" });
            return;
          }
          this.result = result.data.face[0];
        },
        fail: res => {
            wx.showToast({ icon: "none", title: res.errMsg });

        },
        complete: _ => {
          wx.hideLoading();
        }
      });
    },
    getImage(type = "camera") {
      wx.chooseImage({
        sizeType: ["original"],
        sourceType: [type],
        success: res => {
          const image = res.tempFiles[0];
          if (image.size > 1024e3) {
            wx.showToast({ icon: "none", title: "Picture is too big" });
            return;
          }
          this.image = image.path;
          this.analyzeImage(image.path);
        }
      });
    },
    handleCamera() {
      this.getImage();
    },
    handleChoose() {
      this.getImage("album");
    }
  },
  mounted() {},
  onShareAppMessage() {
    if (this.result) {
      return {
        title: `I have a face with [${this.result.beauty}], Play with me`
      };
    } else {
      return {
        title: 'Share what you want'
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.beauty-wrapper {
  text-align: center;
  margin-top: 100px;

  .image {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
  }

  .info {
    margin: 800rpx 30rpx 0;
    padding: 50rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.95);
    font-size: 32rpx;
    line-height: 2;
    color: #495057;
  }

  .controls {
    position: fixed;
    bottom: 0;
    padding: 80rpx 0;
    width: 100%;
  }

  .btn-start {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 400rpx;
    padding: 5rpx 50rpx;
    border-radius: 50rpx;
    background: rgba(73, 80, 87, 0.7);
    .icon {
      width: 32rpx;
      height: 32rpx;
      background: url('data:image/svg+xml,<svg version="1.1" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path style="fill:#fff" d="M8,7C6.896,7,6,7.896,6,9s0.896,2,2,2s2-0.896,2-2S9.104,7,8,7z M15,3h-2.503L12,1.771C11.734,1.18,11.422,1,11,1H5  C4.578,1,4.266,1.18,4,1.771L3.503,3H1C0.45,3,0,3.45,0,4v10c0,0.55,0.45,1,1,1h14c0.55,0,1-0.45,1-1V4C16,3.45,15.55,3,15,3z M8,13  c-2.209,0-4-1.791-4-4s1.791-4,4-4s4,1.791,4,4S10.209,13,8,13z"/></svg>');
    }
    .text {
      color: #fff;
      font-size: 30rpx;
    }
  }

  .btn-start-hover {
    background: rgba(73, 80, 87, 0.9);
  }
}
</style>
