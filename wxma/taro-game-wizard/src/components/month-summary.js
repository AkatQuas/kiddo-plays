import Taro, { Component } from '@tarojs/taro'
import { View } from '@tarojs/components'

export class MonthSummary extends Component {
    render() {
        const { monthSummary } = this.props;
        return (
            <View className='month-summary'>
                {
                    monthSummary.map(item => (
                        <View
                            key={item.key}
                            className="month-summary__item"
                        >
                            <View className="label">{item.label}</View>
                            <View className="value">{item.value}</View>
                        </View>
                    ))
                }
            </View>
        )
    }
}