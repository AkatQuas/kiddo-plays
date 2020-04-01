<template>
    <div>
        <h3>Edit the User</h3>
        <p>Locale : {{ $route.query.locale }}</p>
        <p>Analytics : {{ $route.query.q }}</p>
        <hr>
        <button class="btn btn-primary" @click="confirmed = true">Confirm</button>
    </div>
</template>
<script>
    export default {
        data() {
            return {
                confirmed: false
            }
        },
        beforeRouteLeave(to, from, next) {
            if (this.confirmed) {
                next();
            } else {
                if (confirm('The page has not save the changes, are you sure to leave?')) {
                    next();
                } else {
                    next(false);
                }
            }
        }
    }
</script>