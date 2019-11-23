<template>
    <div class='tinymce-container editor-container'>
        <textarea class='tinymce-textarea' :id="id"></textarea>
    </div>
</template>

<script>
    export default {
        name: 'tinymce',
        props: {
            id: {
                type: String,
                default: 'tinymceEditor'
            },
            value: {
                type: String,
                default: ''
            },
            toolbar: {
                type: Array,
                required: false,
                default() {
                    return [ 'removeformat undo redo |  bullist numlist | outdent indent | forecolor ', 'fullscreen code | bold italic blockquote | alignleft aligncenter alignright | h2 p link qnimage ' ];
                }
            },
            plugins: {
                type: String,
                default() {
                    return 'advlist,autolink,code,paste,textcolor, colorpicker,fullscreen,link,lists,image,wordcount, imagetools ';
                }
            },
            data() {
                return {
                    hasChange: false,
                    hasInit: false,
                    qn_image_list: []
                };
            },
            menubar: {
                default: ''
            },
            width: {
                type: Number,
                required: false,
                default: 360
            },
            height: {
                type: Number,
                required: false,
                default: 600
            }
        },
        data() {

            return {
                qnToken: ''
            };
        },
        watch: {
            value( val ) {
                if ( !this.hasChange && this.hasInit ) {
                    this.$nextTick(() => tinymce.get(this.id).setContent(val));
                }
            }
        },
        mounted() {
            const _this = this;
            tinymce.init({
                selector: `#${this.id}`,
                height: this.height,
                width: this.width,
                body_class: 'panel-body ',
                object_resizing: false,
                language: 'zh_CN',
                language_url: '/static/tinymce/langs/zh_CN.js',
                toolbar: this.toolbar,
                menubar: this.menubar,
                plugins: this.plugins,
                end_container_on_empty_block: true,
                powerpaste_word_import: 'clean',
                code_dialog_height: 450,
                code_dialog_width: 1000,
                advlist_bullet_styles: 'square',
                advlist_number_styles: 'default',
                block_formats: '普通标签=p;小标题=h2;',
                imagetools_cors_hosts: [ 'wpimg.wallstcn.com', 'wallstreetcn.com' ],
                imagetools_toolbar: 'watermark',
                default_link_target: '_blank',
                link_title: false,
                init_instance_callback: editor => {
                    if ( _this.value ) {
                        editor.setContent(_this.value);
                    }
                    _this.hasInit = true;
                    editor.on('NodeChange Change KeyUp', () => {
                        this.hasChange = true;
                        this.$emit('input', editor.getContent({ format: 'raw' }));
                    });
                },
                setup( editor ) {
                    editor.addButton('h2', {
                        title: '小标题', // tooltip text seen on mouseover
                        text: '小标题',
                        onclick() {
                            editor.execCommand('mceToggleFormat', false, 'h2');
                        },
                        onPostRender() {
                            const btn = this;
                            editor.on('init', () => {
                                editor.formatter.formatChanged('h2', state => {
                                    btn.active(state);
                                });
                            });
                        }
                    });
                    editor.addButton('p', {
                        title: '正文',
                        text: '正文',
                        onclick() {
                            editor.execCommand('mceToggleFormat', false, 'p');
                        },
                        onPostRender() {
                            const btn = this;
                            editor.on('init', () => {
                                editor.formatter.formatChanged('p', state => {
                                    btn.active(state);
                                });
                            });
                        }
                    });
                    editor.addButton('qnimage', {
                        title: '插入本地图片',
                        text: '插入本地图片',
                        onclick() {
                            editor.windowManager.open({
                                title: '上传图片',
                                width: 600,
                                height: 200,
                                body: [ {
                                    type: 'container',
                                    html: `
                        <div class="mce-container" hidefocus="1" tabindex="-1">
                            <div style="mce-container-body">
                            <form method="post" action="http://upload.qiniu.com/" enctype="multipart/form-data">
                                <input name="file" id="qn_file" type="file" />
                            </form>
                            </div>
                        </div>`
                                } ],
                                onSubmit() {
                                    const Qiniu_UploadUrl = 'http://up.qiniu.com';
                                    const Qiniu_ImageRoot = 'http://ourj88oo4.bkt.clouddn.com/';
                                    let Qiniu_upload = function ( f, token, key ) {
                                        let xhr = new XMLHttpRequest();
                                        xhr.open('POST', Qiniu_UploadUrl, true);
                                        let formData, startDate;
                                        formData = new FormData();
                                        if ( key !== null && key !== undefined ) formData.append('key', key);
                                        formData.append('token', token);
                                        formData.append('file', f);

                                        xhr.onreadystatechange = function ( response ) {
                                            if ( xhr.readyState === 4 && xhr.status === 200 && xhr.responseText !== '' ) {
                                                let blkRet = JSON.parse(xhr.responseText);
//                                                // console.log('success',blkRet);
//                                                // console.log('img url',Qiniu_ImageRoot+blkRet.hash)
                                                editor.insertContent('<img alt="" height="auto" width="100%" src="' + Qiniu_ImageRoot + blkRet.hash + '"/>');

                                            } else if ( xhr.status !== 200 && xhr.responseText ) {
                                                _this.$message.error('网络错误，图片上传失败！');
                                            }
                                        };
                                        xhr.send(formData);
                                    };
                                    // console.log('token',_this.qnToken)
                                    let token = _this.qnToken;
                                    let fileloader = document.getElementById('qn_file');
                                    if ( fileloader.files.length > 0 && token !== '' ) {

                                        const isGOOD = fileloader.files[ 0 ].type === 'image/jpeg' || fileloader.files[ 0 ].type === 'image/png';

                                        if ( !isGOOD ) {
                                            return _this.$message.error('上传图片只能是 JPG / PNG 格式!');
                                        }
                                        Qiniu_upload(fileloader.files[ 0 ], token);
                                    } else {
                                        console.error('form input error');
                                    }
                                }
                            });

                        }
                    });
                }
            });
        },
        created() {
            window.alert('文本编辑器初始化需要七牛云的token！');
        },
        destroyed() {
            tinymce.get(this.id).destroy();
        }
    };
</script>

<style scoped>
    .tinymce-container {
        position: relative
    }

    .tinymce-textarea {
        visibility: hidden;
        z-index: -1;
    }

    .editor-custom-btn-container {
        position: absolute;
        right: 15px;
        top: 18px;
    }

    .editor-upload-btn {
        display: inline-block;
    }
</style>
