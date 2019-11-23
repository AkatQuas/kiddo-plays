const { Controller } = require('egg')
const fs = require('fs');
const path = require('path');
const pump = require('mz-modules/pump');
const sendToWormhole = require('stream-wormhole');

class ImgUpload extends Controller {
    async index() {
        const { ctx } = this;
        const parts = ctx.multipart();
        const res = {};
        let part;
        while ((part = await parts())) {
            if (part.length) {
                // arrays are busboy fields
                if (!part[2] && !part[3]) res[part[0]] = part[1];
                // /*
                console.log('field: ' + part[0]);
                console.log('value: ' + part[1]);
                console.log('valueTruncated: ' + part[2]);
                console.log('fieldnameTruncated: ' + part[3]);
                // */
            } else {
                if (!part.filename) {
                    // user click `upload` before choose a file,
                    // `part` will be file stream, but `part.filename` is empty
                    // must handler this, such as log error.
                    break;
                }
                /*
                // otherwise, it's a stream
                console.log('field: ' + part.fieldname);
                console.log('filename: ' + part.filename);
                console.log('encoding: ' + part.encoding);
                console.log('mime: ' + part.mime);
                */
                const ext = part.mime.split('/')[1];
                const target = path.join(this.config.baseDir, `upload/temp-name.${ext}`);
                try {
                    const writeStream = fs.createWriteStream(target);
                    await pump(part, writeStream);
                } catch (err) {
                    await sendToWormhole(part);
                    ctx.createError(500, 'Picture Stream Parsing Failed')
                    return
                }
            }
        }
        
        ctx.createSuccess(true);
    }
}

module.exports = ImgUpload;