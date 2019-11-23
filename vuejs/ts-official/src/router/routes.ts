import { RouteConfig } from 'vue-router';
const _import = process.env.NODE_ENV === 'development' ? (file: string) => require('@/views/' + file).default : (file: string) => () => import('@/views/' + file);

export const routes: RouteConfig[] = [
    {
        path: '/p2',
        name: 'Page2',
        component: _import('p2')
    },
    {
        path: '/p3',
        name: 'Page3',
        component: _import('p3')
    },
    {
        path: '/p4',
        name: 'Page4',
        component: _import('p4')
    },
    {
        path: '/p5',
        name: 'Page5',
        component: _import('p5')
    },
    {
        path: '/404',
        name: 'Page404',
        component: _import('misc/404')
    },
    {
        path: '*',
        redirect: { name: 'Page404'}
    }
];