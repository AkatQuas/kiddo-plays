<template>
    <div>
        <h3>Some User Detail</h3>
        <p>User loaded has ID : {{ $route.params.id }}</p>
        <router-link
                tag="button"
                :to="link"
                class="btn btn-primary">Edit User here
        </router-link>
    </div>
</template>

<script>
    export default {
        data() {
            return {
                link: {
                    name: 'userEdit',
                    params: {
                        id: this.$route.params.id
                    },
                    query: {
                        locale: 'en', q: 100
                    },
                    hash: '#data'
                }
            }
        },
        beforeRouteEnter(to, from, next) {
            if (Math.random() > 0.5) {
                next(vm => {
                    console.log('callback in the userEdit');
                    console.log(vm.link);
                });
            } else {
                next(false);
            }

        }
    }
</script>