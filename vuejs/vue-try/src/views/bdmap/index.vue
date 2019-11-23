<template>
    <div>
        <p><a href="https://dafrok.github.io/vue-baidu-map/Index.vue#/">Detailed
            Documents</a></p>
        <button @click="convert">convert</button>
        <p>
            比例尺 -> BmScale , 定位 -> BmGeolocation , 版权 -> BmCopyright , 城市列表 ->
            BmCityList <br>
            点 -> BmMarker , 标签 -> BmLabel , 折线 -> BmPloyline , 多边形 -> BmPolygon
            , 地区检索 -> BmLocalSearch <br>
        </p>
        <baidu-map
                class="bm-view"
                ak="ZgzBP8UbOEe2a5EuV653WAgMLRpltS7w"
                @ready="handler"
                :center="center"
                :scroll-wheel-zoom="true"
                :zoom="19"
        >
            <bm-scale
                    anchor="BMAP_ANCHOR_TOP_RIGHT"
            ></bm-scale>

            <bm-geolocation
                    anchor="BMAP_ANCHOR_BOTTOM_RIGHT"
                    :autoLocation="true"
            ></bm-geolocation>

            <bm-map-type
                    :map-types="['BMAP_NORMAL_MAP', 'BMAP_HYBRID_MAP','BMAP_SATELLITE_MAP']"
                    anchor="BMAP_ANCHOR_TOP_LEFT"></bm-map-type>

            <bm-copyright
                    anchor="BMAP_ANCHOR_TOP_RIGHT"
                    :copyright="[{id: 1, content: 'Copyright Message', bounds: {ne: {lng: 110, lat: 40}, sw:{lng: 0, lat: 0}}}, {id: 2, content: '<a>我是版权信息</a>'}]">
                >
            </bm-copyright>

            <!--<bm-city-list-->
            <!--anchor="BMAP_ANCHOR_TOP_LEFT"-->
            <!--&gt;</bm-city-list>-->

            <bm-marker
                    :position="{lng: 120.420959098264575, lat: 28.099306616932154}"
                    :dragging="true"
                    animation="BMAP_ANIMATION_BOUNCE"
            >

                <!--
                <bm-label
                        content="我爱北京天安门"
                        :labelStyle="{color: 'red', fontSize : '24px'}"
                        :offset="{width: -35, height: 30}" />
                -->
            </bm-marker>

            <bm-polyline
                    :path="polyline"
                    stroke-color="blue"
                    :stroke-opacity="0.5"
                    :stroke-weight="0"
                    :editing="true"
                    @lineupdate="onLineUpdate"
            ></bm-polyline>

        </baidu-map>
    </div>
</template>

<style lang="scss" scoped>
    .bm-view {
        width: 100%;
        height: 600px;
    }
</style>

<script>
    import {
        BaiduMap,
        BmScale,
        BmGeolocation,
        BmCopyright,
        BmCityList,
        BmMarker,
        BmLabel,
        BmPolyline,
        BmMapType
    } from 'vue-baidu-map';
    import arr from './4石垟古道公路.kmlpath_No_0';

    const mi = [].concat(arr);

    export default {
        name: 'Map',
        data () {
            return {
                __bmap: {},
                __map: {},
                center: { lng: 0, lat: 0 },
                polyline: [
                    {
                        'lng': '120.420959098264575',
                        'lat': '28.099306616932154'
                    }, {
                        'lng': '120.420995643362403',
                        'lat': '28.099314412102103'
                    }, {
                        'lng': '120.421003354713321',
                        'lat': '28.099318603053689'
                    }, {
                        'lng': '120.421016095206141',
                        'lat': '28.099327655509114'
                    }, {
                        'lng': '120.421054065227509',
                        'lat': '28.099350119009614'
                    }, {
                        'lng': '120.421202257275581',
                        'lat': '28.09949018061161'
                    }, {
                        'lng': '120.421273503452539',
                        'lat': '28.099634014070034'
                    }, {
                        'lng': '120.421275850385427',
                        'lat': '28.099638959392905'
                    }, {
                        'lng': '120.421279538422823',
                        'lat': '28.099660165607929'
                    }, {
                        'lng': '120.421288590878248',
                        'lat': '28.099680282175541'
                    }, {
                        'lng': '120.421291273087263',
                        'lat': '28.099693190306425'
                    }, {
                        'lng': '120.421319855377078',
                        'lat': '28.099725376814604'
                    }, {
                        'lng': '120.421353047713637',
                        'lat': '28.099760999903083'
                    }, {
                        'lng': '120.421405602246523',
                        'lat': '28.099806597456336'
                    }, {
                        'lng': '120.421435693278909',
                        'lat': '28.099827216938138'
                    }
                ],
                poly2: mi
            };
        },
        components: {
            BaiduMap,
            BmScale,
            BmGeolocation,
            BmCopyright,
            BmCityList,
            BmMarker,
            BmLabel,
            BmMapType,
            BmPolyline
        },
        methods: {
            handler ({ BMap, map }) {
//                console.log(BMap, map)
                this.__bmap = BMap;
                this.__map = map;
                this.center.lng = this.polyline[0].lng;
                this.center.lat = this.polyline[0].lat;
            },
            convert () {
                const convertor = new this.__bmap.Convertor();

                let mirror = this.polyline,
                    sub = [],
                    convertret = [];
                while ( mirror.length > 0 ) {
                    sub.push(mirror.splice(0, 10));
                }
                console.log(sub);


                for ( let i = 0, l = sub.length; i < l; i++ ) {
                    let points = [];
                    for ( let si = 0, sl = sub[i].length; si < sl; si++ ) {
                        let x = sub[i][si].lng,
                            y = sub[i][si].lat;
                        let ggP = new this.__bmap.Point(x, y);
                        points.push(ggP);
                    }
                    convertor.translate(points, 1, 5, (data) => {
                        let tmp = [];
                        for ( let i = 0, l = data.points.length; i < l; i++ ) {
                            let p = {};
                            p.lng = data.points[i].lng;
                            p.lat = data.points[i].lat;
                            tmp.push(p);
                        }
                        convertret = convertret.concat(tmp);
                        this.polyline = convertret;
                    });
                }
            },
            onLineUpdate (e) {
                console.log(e.target);
                const markers = e.target.getPath();
//                markers.forEach(marker => marker.addEventListener('rightclick', () => {
//                    console.log('right')
//                })
//                console.log(markers)
            }
        }
    };
</script>
