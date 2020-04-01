import Vue from 'vue'
import Hello from './components/Hello.vue'

let v = new Vue({
    el: '#app',
    template:`
        <div>
            <div>Hello {{name}}! </div>
            <hello :name="name" :initialEnthusiasm="5"/>
        </div>
    `,
    data: {
        name: 'World'
    },
    components: {
        Hello
    }
})
