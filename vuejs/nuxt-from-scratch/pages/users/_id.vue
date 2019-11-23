<template>
    <div>
        <h1> dynamic id here: {{$route.params.id}}</h1>
    </div>
</template>
<script>
export default {
    
    validate ( {params } ) {
        return /^\d$/.test(params.id)
    }
}
</script>
