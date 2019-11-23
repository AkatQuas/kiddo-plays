import Taro, { Component } from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.scss'
import GiftCard from '../../components/gift-card';

export default class Gifts extends Component {
    config = {
        navigationBarTitleText: '礼包',
        navigationBarBackgroundColor: '#da3a00',
    }
    state = {
        gifts: [
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/hand_of_midas_lg.png',
                label: 'Hand Of Midas',
                price: 2150
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/manta_lg.png',
                label: 'Manta Style',
                price: 5275
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/bloodthorn_lg.png',
                label: 'Bloodthron',
                price: 5500
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/nullifier_lg.png',
                label: 'Nullifier',
                price: 4950
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/shivas_guard_lg.png',
                label: 'Shivas Guard',
                price: 4700
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/radiance_lg.png',
                label: 'Radiance',
                price: 5150
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/silver_edge_lg.png',
                label: 'Silver Edge',
                price: 5800
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/mjollnir_lg.png',
                label: 'Mjollnir',
                price: 5400
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/greater_crit_lg.png',
                label: 'Deadalus',
                price: 5250
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/butterfly_lg.png',
                label: 'Butterfly',
                price: 5150
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/monkey_king_bar_lg.png',
                label: 'Monkey King Bar',
                price: 5000
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/heart_lg.png',
                label: 'Heart Of Tarrasque',
                price: 5200
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/assault_lg.png',
                label: 'Assault Cuirass',
                price: 5350
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/refresher_lg.png',
                label: 'Refresh Orb',
                price: 5100
            },

            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/skadi_lg.png',
                label: 'Eye of Skadi',
                price: 5450
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/satanic_lg.png',
                label: 'Satanic',
                price: 6150
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/sheepstick_lg.png',
                label: 'Scythe Of Vyse',
                price: 5750
            },
            {
                src: 'https://steamcdn-a.akamaihd.net/apps/dota2/images/items/rapier_lg.png',
                label: 'Divine Rapier',
                price: 6200
            }
        ],
        chosen: [
            'Divine Rapier'
        ],
    }
    handleItem(item) {
        const { chosen } = this.state;

        if (chosen.includes(item.label)) {
            return Taro.showToast({
                title: '你已经领取过了，下次再来吧～',
                icon: 'none'
            })
        }
        chosen.push(item.label);
        this.setState({
            chosen
        }, _ => {
            Taro.showToast({
                title: `成功领取${item.label}`,
                icon: 'none'
            })
        })
    }
    render() {
        const { gifts, chosen } = this.state;
        return (
            <View className="gifts">
                <View className="card-wrapper">
                    {
                        gifts.map(item =>
                            <GiftCard key={item.src} label={item.label} chosen={chosen} src={item.src} price={item.price} onClick={this.handleItem.bind(this, item)} />
                        )
                    }
                </View>
            </View>
        )
    }
}

