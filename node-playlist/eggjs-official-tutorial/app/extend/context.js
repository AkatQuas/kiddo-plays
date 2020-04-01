module.exports = {

    /**
     * 创建返回对象
     * @param code
     * @param success
     * @param data
     * @param message
     */
    createResult({ code, success, data, message }) {
        this.body = {
            code,
            success,
            data,
            message
        }
    },

    /**
     * 创建成功返回值
     */
    createSuccess(data = { result: true }, message = null) {
        this.createResult({
            code: 200,
            success: true,
            data,
            message
        });
    },

    /**
     * 创建错误返回值
     * @param {*} code
     * @param {*} message
     */
    createError(code = 500, message = 'Server Internal Error') {
        this.createResult({
            code,
            success: false,
            data: null,
            message
        });
    }
}