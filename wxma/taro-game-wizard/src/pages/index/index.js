import Taro, { Component } from '@tarojs/taro'
import { View, Image } from '@tarojs/components'
import './index.scss'
import bg from '../../assets/bg.png'

export default class Index extends Component {
  config = {
    navigationBarTitleText: 'DotA2助手',
    backgroundColor: '#000000'
  }
  state = {
  }
  goGifts() {
    Taro.navigateTo({
      url: '../gifts/index'
    })
  }

  goSign() {
    Taro.navigateTo({
      url: '../sign/index'
    })
  }
  render() {
    return (
      <View className='index'>
        <Image src={bg} style={{ width: '750rpx', height: '600rpx' }} />
        <View className="button-group">
          <View className="func-button" onClick={this.goGifts.bind(this, null)}>领礼包</View>
          <View className="func-button" onClick={this.goSign.bind(this, null)}>签到</View>
        </View>
      </View>
    )
  }
}

