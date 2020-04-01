<template>
    <div>
        <p>Using <code>vue-svgicon</code> to use icon in the page with little file size. The link is <a href="https://github.com/MMF-FE/vue-svgicon">here</a></p>
        <div>
            <p><strong>Tips:</strong></p>
            <ol>
                <li>You need a well format svg file for generating, otherwise you can't use this svg icon.</li>
                <li>In the package.json file to use <code>npm run <i>script</i></code> to generating the icons from <code>source path</code> to <code>destination path</code>, which is a trick to generate icons in different folders so you can import them individually to reduce the bundle size. So it is a wonderful idea to put the original svg files in clear and separated folders.</li>
                <li>In the script part in a single component vue file,<br>
<pre>// import SvgIcon component
import SvgIcon from 'vue-svgicon'
// import the icons
import '@destination path/'

// register the component locally
export default {
    ...
    components:{
        ...
        svgicon: SvgIcon
    }
    ...
}
</pre>

                </li>
                <li>To change style, read the <a href="https://github.com/MMF-FE/vue-svgicon/blob/master/README.md">docs</a> carefully.</li>
            </ol>
        </div>
            <svgicon icon="arrow" color="red" width="200" height="200"></svgicon>
            <svgicon icon="arrow" color="#8205f4" width="150" height="150" dir="down"></svgicon>
            <svgicon icon="quantity" color="green" width="100" height="100"></svgicon>
            <svgicon icon="quantity" color="#333" width="100" height="100" dir="left"></svgicon>

    </div>
</template>

<script>
    import SvgIcon from 'vue-svgicon'
    import '../../assets/icons'

    export default {
        components:{
            svgicon:SvgIcon
        }
    }
</script>

<style scoped>

</style>
