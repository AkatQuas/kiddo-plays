module.exports = {
    loading: '~/components/loading.vue',
    generate: {
        fallback: true,
        
    },
    css: [
        'assets/main.css',
    ],
    router: {
        middleware: ['stats', 'i18n']
    },
    head: {
        meta: [
            { charest: 'utf-8'},
            {name: 'viewport', content: 'width=device-width,initial-scale=1'}
        ],
        link: [
            {rel: 'stylesheet', herf: 'https://fonts.googleapis.com/css?family=Roboto'}
        ]
    },
    build: {
        vendor: [
            'axios',
            'vue-i18n'
        ]
    },
    plugins: [
        { src: '~/plugins/vue-notifications', ssr: false },
        '~/plugins/i18n'
    ],
    modules: [
        ['~/modules/simple', { token: '123'}],
        '~/modules/promise-based',
        '~/modules/callback-based'
    ]
}