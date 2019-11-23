<template>
    <div>
        <p>
            The user want to upload lots of pictures to the server, a good practice is give a preview on these images before uploading, so the user can remove those they don't like just before uploading.</p>
        <p><i>FileReader</i> and <i>ObjectURL</i> are two useful ways to create a preview on the pictures.</p>
        <ul>
            <li><i>FileReader</i> is ASYNC; <i>ObjectURL</i> is SYNC</li>
            <li><i>FileReader.readAsDataURL</i> returns a string in the form of <i>base64</i>
                which contains a lot of characters; <i>createObjectURL</i> returns a URL with hash
            </li>
            <li><i>FileReader.readAsDataURL</i> would use the original GC in JavaScript; <i>createObjectURL</i>
                will release the memory only the page is closed or call <i>revokeObjectURL</i> manually
            </li>
            <li><i>createObjectURL</i>
                is more efficient. It is recommended to release the memory manually when the image number is to large.
            </li>
        </ul>

        <p>Check the code! </p>
        <hr>
        <p><i>FileReader.readAsDataURL</i></p>
        <div class="upload-pic">
            <input
                    hidden
                    type="file"
                    multiple
                    accept="image/gif,image/png,image/jpeg,image/jpg,image/svg"
                    id="upload-pic"
                    @change="imageHandler"
            >

            <label for="upload-pic"> upload </label>
        </div>
        <div id="image-list"></div>

        <hr>
        <p><i>createObjectURL</i></p>
        <br>
        <div class="upload-pic">
            <input
                    hidden
                    type="file"
                    multiple
                    accept="image/gif,image/png,image/jpeg,image/jpg,image/svg"
                    id="upload-pic2"
                    @change="imageHandler2"
            >

            <label for="upload-pic2"> upload </label>
        </div>
        <br>
        <div id="image-list2"></div>

    </div>
</template>

<style lang="scss" scoped>
    .upload-pic {
        border: 1px solid #66ccff;
        margin-bottom: 15px;
    }

</style>

<script>
    export default {
        methods: {
            imageHandler( event ) {
                const files = Array.from(event.target.files);
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);

                    reader.onload = e => {
                        const img = new Image();
                        img.src = e.target.result;
                        document.querySelector('#image-list').appendChild(img);
                    };

                    reader.onerror = e => {
                        console.log('There is an error!');
                    };
                });
            },
            imageHandler2( event ) {
                const files = Array.from(event.target.files);

                const createObjectURL = file => {
                    if ( window.URL ) {
                        return window.URL.createObjectURL(file);
                    } else {
                        return window.webkitURL.createObjectURL(file);
                    }
                };

                const revokeObjectURL = file => {
                    if ( window.URL ) {
                        return window.URL.revokeObjectURL(file);
                    } else {
                        return window.webkitURL.revokeObjectURL(file);
                    }
                };

                files.forEach(file => {
                    const img = new Image();
                    let urltmp;
                    urltmp = img.src = createObjectURL(file);

                    document.querySelector('#image-list2').appendChild(img);
                    img.onload = _ => {
                        revokeObjectURL(urltmp);
                    };
                });

            }
        }
    };
</script>

