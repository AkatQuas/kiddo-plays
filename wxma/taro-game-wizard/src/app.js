import Taro, { Component } from '@tarojs/taro'
import Index from './pages/index'

import './app.scss'

class App extends Component {
  config = {
    pages: [
      'pages/index/index',
      'pages/gifts/index',
      'pages/sign/index'
    ],
    window: {
      navigationBarTitleText: 'DotA小精灵',
      navigationBarTextStyle: 'white',
      navigationBarBackgroundColor: '#000000',
    }
  }

  componentDidMount () {}

  componentDidShow () {}

  componentDidHide () {}

  componentCatchError () {}

  render () {
    return (
      <Index />
    )
  }
}

Taro.render(<App />, document.getElementById('app'))
