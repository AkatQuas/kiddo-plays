import HelloWorld from '@/views/HelloWorld'
import Currency from '@/views/currency'
import DateTime from '@/views/date-time';
import Rd from '@/views/rd'
import Directives from '@/views/directives'

export const routes = [
    {
        path: '/',
        name: 'HelloWorld',
        exact: true,
        component: HelloWorld
    },
    {
        path: '/currency',
        name: 'Currency',
        component: Currency
    },
    {
        path: '/date-time',
        name: 'DateTime',
        component: DateTime
    },
    {
        path: '/rd',
        name: 'Random',
        component: Rd
    },
    {
        path: '/directives',
        name: 'Directives',
        component: Directives
    }
]

export const jumps = routes.map(({ path, name }) => ({ path, name }))
