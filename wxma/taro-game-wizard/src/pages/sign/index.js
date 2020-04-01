import Taro, { Component } from '@tarojs/taro'
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components'
import './index.scss'
import MonthSummary from '../../components/month-summary';
import arrow from '../../assets/arrow.png';

const zeroPrefix = n => n < 10 ? '0' + n : n;

const computeKey = (y, m, d) => {
    if (m < 1) {
        y -= 1;
        m += 12
    } else if (m > 12) {
        y += 1;
        m -= 12;
    }
    // m 显示月份 01-12
    return `${y}-${zeroPrefix(m)}-${zeroPrefix(d)}`
}

export default class InvCal extends Component {
    config = {
        navigationBarTitleText: '签到日历'
    }
    state = {
        monthSummary: [
            {
                key: 'monthSign',
                label: '月签到总数',
                value: '22'
            },
            {
                key: 'allSign',
                label: '总签到数',
                value: '1000'
            }
        ],
        DAYSTITLE: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
        MMP: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
        sDays: [],
        signDays: [
            '2018-06-01',
            '2018-06-17',
            '2018-06-21',
            '2018-06-07',
            '2018-06-08',
            '2018-06-10',
        ],
        dSignTime: '',
        dBonus: 0,
        rYear: 2018,
        rMonth: 0,
        selectDate: '',
        deadToday: ''
    }
    calendar(year, month) {
        // month ，真实月份， 0-11 的取值
        const dateInstance = new Date(year, month + 1, 0);

        //当前月总天数
        const fullDay = parseInt(dateInstance.getDate(), 10);

        //当前月第一天周几
        dateInstance.setMonth(month);
        dateInstance.setDate(1);
        const startWeek = parseInt(dateInstance.getDay(), 10);

        //上个月的天数
        dateInstance.setDate(0);
        const lastMonthDay = parseInt(dateInstance.getDate(), 10);

        const totalDay = 42;

        const lastMonthDaysList = [], currentMonthDaysList = [], nextMonthDaysList = [];
        // 遍历日历格子
        let date;
        for (let i = 0; i < totalDay; i++) {
            if (i < startWeek) {
                date = i + 1 - startWeek + lastMonthDay;
                lastMonthDaysList.push({
                    key: computeKey(year, month, date),
                    date,
                    month: -1
                });

            } else if (i < (startWeek + fullDay)) {

                //当月天数
                date = i + 1 - startWeek;
                currentMonthDaysList.push({
                    key: computeKey(year, month + 1, date),
                    date,
                    month: 0
                });

            } else {
                //当月最后一天不是周六的时候，剩下的各自就渲染下月的天数
                date = i + 1 - startWeek - fullDay;
                nextMonthDaysList.push({
                    key: computeKey(year, month + 2, date),
                    date,
                    month: 1
                });
            }
        }
        const all = [...lastMonthDaysList, ...currentMonthDaysList, ...nextMonthDaysList];
        const TwoD = [];
        while (all.length) {
            TwoD.push(all.splice(0, 7))
        }
        this.setState({
            rYear: year,
            rMonth: month,
            sDays: TwoD
        });
    }

    changeMonth(step) {
        // todo animejs ??
        step = parseInt(step, 10);
        const { rYear, rMonth, MMP } = this.state;
        const x = new Date();
        x.setFullYear(rYear);
        x.setMonth(rMonth + step);
        const nm = x.getMonth();
        const ny = x.getFullYear();
        this.calendar(ny, nm);
        this.fetchMonth(`${ny}-${MMP[nm]}`)
    }

    changeDate(item) {
        item.month && this.changeMonth(item.month)
        this.setState({
            selectDate: item.key
        }, this.fetchDate);
    }

    fetchMonth(spe) {

    }

    fetchDate() {
        console.log('选择了日期，修改签到时间')
        const { selectDate, deadToday } = this.state;
        if (selectDate > deadToday) {
            this.setState({
                dBonus: 0,
                dSignTime: '',
            })
        } else {
            const dBonus = ~~(Math.random() * 50 + 50);
            const dSignTime = '10:' + ~~(Math.random() * 59 + 1)
            this.setState({
                dSignTime,
                dBonus
            })
        }

    }

    componentDidMount() {
        const today = new Date('2018-06-01');
        const ny = today.getFullYear();
        const nm = today.getMonth();
        const nd = today.getDate();
        const { MMP } = this.state;
        this.calendar(ny, nm);
        this.fetchMonth(`${ny}-${MMP[nm]}`)
        this.setState({
            selectDate: `${ny}-${zeroPrefix(nm + 1)}-${zeroPrefix(nd)}`,
            deadToday: `${ny}-${zeroPrefix(nm + 1)}-${zeroPrefix(nd)}`
        });
    }

    render() {
        const { rYear, rMonth, sDays, monthSummary, DAYSTITLE, MMP, deadToday, selectDate, signDays, dBonus, dSignTime } = this.state;

        return (
            <View className="inv-cal">
                <View className="ym-title">
                    <View className="ym-title__l" onClick={this.changeMonth.bind(this, '-1')} ><Image src={arrow} /></View>
                    <View className="ym-title__m">{rYear}年{MMP[rMonth]}月</View>
                    <View className="ym-title__r" onClick={this.changeMonth.bind(this, '1')} ><Image src={arrow} /></View>
                </View>
                <MonthSummary monthSummary={monthSummary} />
                <Swiper circular style={{ height: '642rpx' }}>
                    <SwiperItem>
                        <View className="calendar">
                            <View className="calendar-title">
                                {
                                    DAYSTITLE.map(day => (
                                        <Text className="calendar-title-item" key={day}>{day}</Text>
                                    ))
                                }
                            </View>
                            <View className="calendar-dates">
                                {
                                    sDays.map((line, index) => <View className="calendar-line" key={index}>
                                        {
                                            line.map(item => {
                                                return (
                                                    <View
                                                        key={item.key}
                                                        className={`calendar-dates-item ${item.month ? 'grey' : ''} `}
                                                        onClick={this.changeDate.bind(this, item)}
                                                    >
                                                        <View className={`
                                                    calendar-dates-item_date
                                                    ${item.key === selectDate ? 'selected' : ''}
                                                    ${item.key === deadToday ? 'today' : ''}
                                                `}>{item.date}</View>
                                                        <View className="calendar-dates-item_dots">
                                                            {signDays.includes(item.key) ? <View className="calendar-dates-item_dots_signed" /> : null}
                                                        </View>
                                                    </View>
                                                )
                                            })
                                        }
                                    </View>)
                                }
                            </View>
                        </View >
                    </SwiperItem>
                    <SwiperItem>
                        <View className="calendar">
                            <View className="calendar-title">
                                {
                                    DAYSTITLE.map(day => (
                                        <Text className="calendar-title-item" key={day}>{day}</Text>
                                    ))
                                }
                            </View>
                            <View className="calendar-dates">
                                {
                                    sDays.map((line, index) => <View className="calendar-line" key={index}>
                                        {
                                            line.map(item => {
                                                return (
                                                    <View
                                                        key={item.key}
                                                        className={`calendar-dates-item ${item.month ? 'grey' : ''} `}
                                                        onClick={this.changeDate.bind(this, item)}
                                                    >
                                                        <View className={`
                                                    calendar-dates-item_date
                                                    ${item.key === selectDate ? 'selected' : ''}
                                                    ${item.key === deadToday ? 'today' : ''}
                                                `}>{item.date}</View>
                                                        <View className="calendar-dates-item_dots">
                                                            {signDays.includes(item.key) ? <View className="calendar-dates-item_dots_signed" /> : null}
                                                        </View>
                                                    </View>
                                                )
                                            })
                                        }
                                    </View>)
                                }
                            </View>
                        </View >
                    </SwiperItem>
                    <SwiperItem>
                        <View className="calendar">
                            <View className="calendar-title">
                                {
                                    DAYSTITLE.map(day => (
                                        <Text className="calendar-title-item" key={day}>{day}</Text>
                                    ))
                                }
                            </View>
                            <View className="calendar-dates">
                                {
                                    sDays.map((line, index) => <View className="calendar-line" key={index}>
                                        {
                                            line.map(item => {
                                                return (
                                                    <View
                                                        key={item.key}
                                                        className={`calendar-dates-item ${item.month ? 'grey' : ''} `}
                                                        onClick={this.changeDate.bind(this, item)}
                                                    >
                                                        <View className={`
                                                    calendar-dates-item_date
                                                    ${item.key === selectDate ? 'selected' : ''}
                                                    ${item.key === deadToday ? 'today' : ''}
                                                `}>{item.date}</View>
                                                        <View className="calendar-dates-item_dots">
                                                            {signDays.includes(item.key) ? <View className="calendar-dates-item_dots_signed" /> : null}
                                                        </View>
                                                    </View>
                                                )
                                            })
                                        }
                                    </View>)
                                }
                            </View>
                        </View >
                    </SwiperItem>
                </Swiper>
                <View className="day-summary">
                    <View className="day-summary-sign">
                        <View className="day-summary-sign_dot" />
                        <View className="day-summary-item">
                            <View className="day-summary-item_name">
                                今日签到时间：{dSignTime ? dSignTime : '未签到'}
                            </View>
                            <View className="day-summary-item_desc">
                                {dBonus ? `获得积分 ${dBonus}` : '无奖励'}
                            </View>
                        </View>
                    </View>
                    <View className="sign-btn">
                        {dBonus ? '已签到' : '签到'}
                    </View>
                </View>
            </View >
        )
    }
}

