# Overview

针对小程序的一些开发方式，进行学习和练习。

# Project 

- vanilla: 用小程序本身的语法和方式

- taro: 京东的[Taro.js](https://github.com/NervJS/taro)，略微有点坑。 

- mpvue: 美团的[mpvue](https://github.com/Meituan-Dianping/mpvue)，较好的开发脚手架，编译速度很强。

# Comments

**Vanilla**

小程序本身的语法和方式都比较一般，缺点也很明显：

- wxss，不能嵌套，语法高亮只能在其IDE中体现，VScode则没有，与web相比，支持度不广。
- wxml, 语法高亮问题同wxss，写法没什么亮点，在传值时， {{}} 内对变量和对象的解释意义不统一。模板渲染时，传值方式建议按照文档来抄。
- wxs，事件传值是个坑，
- 总的来说，非常僵硬。

**Taro**

- 封装过一层编译过程的小程序开发，react式的开发体验，比较好。但是对于组件的编译比较僵硬，无法按props传函数。props的使用有时候会有限制，需要进行调整。

- Taro 本身封装来一层各种小程序的API调用，所以顶层的写法比较统一。

- 宣称能编译多端，但是从API的使用角度来看，只能说是对代码进行微调，然后才好编译。

总的来说，的确能加快开发速度和提高开发体验，在没有其他框架时，可以选用。

**mpvue**

- 同样是封装过一层编译的小程序开发，vue式。

- 文档写的比Taro要好很多，vue的影子比较明显。来自vue的开发者，强烈推荐。

- 编译速度比Taro要快，主要卡在微信开发者工具的响应。

- mpvue 没有封装过小程序的API，因此在写的过程中，实质上还是在用wx本身的SDK和语法。

- 生命周期的问题建议按照 mpvue 的文档指南来使用。

> “ mpvue 是个好的脚手架。” -- 鲁迅

# Miscellaneous

微信官方的[wepy](https://github.com/Tencent/wepy) 相对于 `Taro` 和 `mpvue` 来说表现都不是很理想，比直接裸写小程序代码差不了多少，不是很推荐。

# Reference

- [微信小程序开发资源汇总](https://github.com/justjavac/awesome-wechat-weapp)
- [官方API文档](https://developers.weixin.qq.com/miniprogram/dev/api/)
- [Taro 文档](https://nervjs.github.io/taro/native-api.html)
- [mpvue 文档](http://mpvue.com/mpvue/) 
