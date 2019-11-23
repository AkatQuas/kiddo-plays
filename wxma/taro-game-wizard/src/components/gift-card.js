import Taro, { Component } from '@tarojs/taro'
import { View, Image } from '@tarojs/components'

export class GiftCard extends Component {
    itemClick() {
        const { onClick } = this.props;
        onClick();
    }
    render() {
        const { src, label, price, chosen } = this.props;
        const isChosen = chosen.includes(label)
        
        return (
            <View className={`gift-card ${isChosen ? 'chosen': ''}`} onClick={this.itemClick}>
                <Image className="image" src={src} />

                <View className="info">
                    <View className="label">{label}</View>
                    <View className="price">${price}</View>
                </View>
            </View>
        )
    }
}