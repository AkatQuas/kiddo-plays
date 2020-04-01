const _import = require('./_import_' + process.env.NODE_ENV);


const routes = [
    {
        path: '/',
        name: 'Home',
        component: _import('Home')
    },
    {
        path: '/trysimple',
        name: 'TrySimple',
        component: _import('TrySimple')
    },
    {
        path: '/baidu-map',
        name: 'BaiduMap',
        component: _import('bdmap/index')
    },
    {
        path: '/amap',
        name: 'Amap',
        component: _import('amap/index')
    },
    {
        path: '/promise',
        name: 'Promise',
        component: _import('promise/index')
    },
    {
        path: '/directive',
        name: 'Directive',
        component: _import('custom-vue/Directive')
    },
    {
        path: '/animation',
        name: 'Animation',
        component: _import('custom-vue/Animation')
    },
    {
        path: '/animation-game',
        name: 'AnimationGame',
        component: _import('custom-vue/AnimationGame')
    },
    {
        path: '/message-box',
        name: 'MessageBox-Wheel',
        component: _import('message-box/index')
    },
    {
        path: '/render-func',
        name: 'RenderFunc-Wheel',
        component: _import('misc/render-func')
    },
    {
        path: '/data-table',
        name: 'DataTable-Wheel',
        component: _import('data-table/index')
    },
    {
        path: '/search-bar',
        name: 'SearchBar-Wheel',
        component: _import('search-bar/index')
    },
    {
        path: '/type-buttons',
        name: 'TypeButton-Wheel',
        component: _import('buttons/index')
    },
    {
        path: '/crypto-coin',
        name: 'Crypto-Coin',
        component: _import('misc/crypto-coin')
    },
    {
        path: '/attrs-listeners',
        name: 'Attrs-&-Listeners',
        component: _import('misc/attrs-n-listeners')
    },
    {
        path: '/captcha',
        name: 'captcha-game',
        component: _import('captcha/index')
    },
    {
        path: '/image-preview-before-upload',
        name: 'image-preview',
        component: _import('misc/image-preview-before-upload')
    },
    {
        path: '/scroll',
        name: 'scroll-view',
        component: _import('scroll/index')
    },
    {
        path: '/carousel',
        name: 'carousel-view',
        component: _import('misc/vue-carousel-try')
    },
    {
        path: '/tinymce',
        name: 'tinymce',
        component: _import('tinymce/index')
    },
    {
        path: '*',
        name: 'Page404',
        component: _import('error/404')
    }
];

export default routes;