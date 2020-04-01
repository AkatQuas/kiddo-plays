import Chats from './components/Chats.vue';
import Contacts from './components/Contacts.vue';
import Discover from './components/Discover.vue';
import Me from './components/Me.vue';

export const routes = [
    {path: '', name: 'news', component: Chats},
    {path: '/contacts', name: 'contacts', component: Contacts},
    {path: '/discover', name: 'discover', component: Discover},
    {path: '/me', name: 'account', component: Me},
    {path: '*', redirect: {path: '/'}}

];