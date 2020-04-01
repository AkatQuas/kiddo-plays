<template>
    <div>
        <div>
            <p>
                <a href="https://elemefe.github.io/vue-amap/#/zh-cn/introduction/install">document for vue-amap</a>
            </p>
            <p>
                amap may not give us some satellite images on some suburban area......words failed to comment on this bug.
                <br>
                To tackled this, we may need to send request satellite tiles from other map server, like google.
                And a little problem is you may not write it in the init hook function in the amap instance, use it in the complete hook function. check the code.
            </p>
        </div>
        <div class="amap-wrapper" id="amapcontainer">
            <el-amap
                    :vid="map_conf.id"
                    :map-manager="amapManager"
                    :center="map_conf.center"
                    :zoom="map_conf.zoom"
                    :plugin="map_conf.plugin"
                    :events="map_conf.events"
            >

                <el-amap-polyline
                        v-for="(polyline,idx) in polylines"
                        :key="'polyline'+idx"
                        :editable="polyline.editable"
                        :path="polyline.path"
                        :strokeColor="polyline.strokeColor"
                        :events="polyline.events"
                ></el-amap-polyline>

                <el-amap-marker
                        v-for="(marker,idx) in markers"
                        :key="'marker'+idx"
                        :position="marker.position"
                        :events="marker.events"
                        :visible="marker.visible"
                        :draggable="marker.draggable"
                ></el-amap-marker>

            </el-amap>
        </div>
        <button
                v-for="(polyline,idx) in polylines"
                :key="idx"
                @click="changeE(polyline)"
        >poly{{idx + 1}}
        </button>
        <hr>
        <input type="file" @change="dealkml">
    </div>
</template>

<style lang="scss" scoped>
    .amap-wrapper {
        width: 100%;
        height: 600px;
    }

</style>

<script>
    import Vue from 'vue';
    import VueAMap, { lazyAMapApiLoaderInstance, AMapManager } from 'vue-amap';

    Vue.use(VueAMap);

    VueAMap.initAMapApiLoader({
        key: '5f4e17cfe103f77b3663b07b5c7d32c3',
        plugin: ['AMap.Autocomplete', 'AMap.PlaceSearch', 'AMap.Scale', 'AMap.OverView', 'AMap.ToolBar', 'AMap.MapType', 'AMap.PolyEditor', 'AMap.CircleEditor', 'AMap.Geocoder']
    });

    let amapManager = new AMapManager();
    //    console.log(AMap)
    export default {
        name: 'map',
        data () {
            let vm = this;
            let sC = '#0000ff';
            let poly_events = {
                click (e) {
                    console.log(e.target);
                },
                end (e) {
                    let newPath = e.target.getPath().map(p => [p.lng, p.lat]);
                    console.log(newPath);
                }
            };
            return {
                amapManager,
                convertUrl: 'http://restapi.amap.com/v3/assistant/coordinate/convert?key=4da8004b248eaed2b40121fd4b40eac6&coordsys=gps&output=json',
                AMap_: {},
                map_: {},
                map_conf: {
                    id: 'amap-vue',
                    zoom: 12,
                    center: [120.678173, 28.004331],
                    plugin: [
                        'ToolBar',
                        {
                            pName: 'MapType',
                            defaultType: 1,
                            events: {
                                init (o) {

                                }
                            }
                        }
                    ],
                    events: {
                        complete (o) {
//                            console.log('map init',o)
//                            console.log(amapManager.getMap());
                            // 加自定义卫星图图层
                            let sateLayer = new AMap.TileLayer.Satellite({
                                map: amapManager.getMap(),
                                zIndex: 3,
                                opacity: 1,
                                getTileUrl: 'http://www.google.cn/maps/vt?lyrs=s@729&gl=cn&x=[x]&y=[y]&z=[z]',
                                detectRetina: true
                            });
                        }
                    }
                },
                polylines: [],
                poly_events,
                sC,
                markers: [
                    {
                        position: [121.5273285, 31.21515044],
                        events: {
                            click: () => {
                                alert('click marker');
                            },
                            dragend: (e) => {
                                this.markers[0].position = [e.lnglat.lng, e.lnglat.lat];
                            }
                        },
                        visible: true,
                        draggable: false
                    }
                ]
            };
        },
        methods: {
            configAfterApiLoad () {
                lazyAMapApiLoaderInstance.load().then(() => {
//                    console.log('aald',lazyAMapApiLoaderInstance)
                    this.AMap_ = AMap;
                });
            },
            drawPolyline (line, map) {

                line = line.map(v => [v.lng, v.lat]);
                console.log(line);
                let polyline = new this.AMap_.Polyline({
                    map: map,
                    path: line
                });
                let p_e = new this.AMap_.PolyEditor(map, polyline);
                p_e.open();
            },
            changeE (polyline) {
                polyline.editable = !polyline.editable;
            },
            dealkml (e) {
                let vm = this;
                console.log(e.target.files);

                let readtxtfile = (file) => {
                    let frI = new FileReader();
                    frI.readAsText(file);
                    frI.onloadend = () => {
                        let str = frI.result;
                        let pointlines = extractfromstr(str);
                        vm.convertPoints(pointlines);
                    };
                };

                let extractfromstr = (str) => {
                    let flag = 0, start, end, substr = '', lines = [], line = [];

                    while ( true ) {
                        if ( str.indexOf('<MultiGeometry>', flag) === -1 ) {
                            break;
                        } else {
                            line = [];
                            start = str.indexOf('<MultiGeometry>', flag);

                            end = str.indexOf('</MultiGeometry>', start);
                            flag = end + 10;
                            substr = str.substring(start, end);

                            start = substr.indexOf('<coordinates>');
                            start += 13;
                            end = substr.indexOf('</coordinates>');

                            substr = substr.substring(start, end);
                            substr = substr.split(' ');
                            substr.pop();

                            //AMap 要求坐标转换的点保留不超过6位的小数
                            substr.map((value) => {
                                let tmp = value.split(',');
                                line.push({
                                    lng: parseFloat(tmp[0]).toFixed(6),
                                    lat: parseFloat(tmp[1]).toFixed(6)
                                });
                            });
                            line = pointsFilter_(line);
//                            console.log(line);
                            lines.push(line);
                        }
                    }
                    //lines is an array contains points array
                    return lines;
                };

                let pointsFilter_ = (points) => {
                    let mirror = [].concat(points);
                    for ( let i = mirror.length - 2; i >= 1; i-- ) {
                        //calculate the distance from end to start
                        let pi = new vm.AMap_.LngLat(mirror[i].lng, mirror[i].lat);

                        let dis = pi.distance([mirror[i + 1].lng, mirror[i + 1].lat]);
                        if ( dis < 20 ) {
                            mirror.splice(i, 1);
                        }
                    }
                    return mirror;
                };


                let files = e.target.files;

                for ( let i = 0, l = files.length; i < l; i++ ) {
                    readtxtfile(files[i]);
                }
            },
            convertPoints (lines) {

                //lines: array of line

                let vm = this;
                vm.polylines = [];

                lines = lines.map(line => {
                    let mirror = [].concat(line),
                        sub = [];
                    console.log(line);
                    while ( mirror.length > 0 ) {
                        sub.push(mirror.splice(0, 40));
                    }

                    let tmp_promise = (ltPoint) => {
                        ltPoint = '&locations=' + (ltPoint.map(p => p.lng + ',' + p.lat)).join('|');
                        let url = vm.convertUrl + ltPoint;
                        return vm.$http.get(url);
                    };

                    let promises = sub.map(sbp => tmp_promise(sbp));

                    Promise.all(promises).then(result => {
                        let polyline = [];

                        result.forEach(obj => {
                            let str = obj.data.locations;
                            str = str.split(';');
                            polyline = polyline.concat(str);
                        });

                        polyline = polyline.map(s => {
                            s = s.split(',');
                            return {
                                lng: s[0],
                                lat: s[1]
                            };
                        });
                        vm.pushPoly(polyline);
                    }, err => {
                        console.log(err);
                        alert('服务器错误，转换失败。');
                        return false;
                    });
                });
            },
            pushPoly (polyline) {

                //careful, a single polyline should be well structured
                let vm = this;
                polyline = polyline.map(p => [p.lng, p.lat]);
                vm.polylines.push({
                    path: polyline,
                    editable: true,
                    strokeColor: vm.sC,
                    events: vm.poly_events
                });
                console.log(vm.polylines);
                vm.map_conf.center = polyline[0];
                vm.map_conf.zoom = 18;
            }
        },
        beforeMount () {
            this.configAfterApiLoad();
        }
    };

</script>
