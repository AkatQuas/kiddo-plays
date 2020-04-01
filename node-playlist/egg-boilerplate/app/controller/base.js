const { Controller } = require('egg');

class BaseController extends Controller {
  get user() {
    // todo
    return this.ctx.session.user;
  }
  success(data = true) {
    this.ctx.body = {
      success: true,
      code: 200,
      data,
    };
  }
  error(message = '网络错误，请重试', code = 500) {
    this.ctx.body = {
      success: false,
      code,
      message
    }
  }
  paramsError(errors) {
    const message = errors.map(item => `参数 ${item.field} 校验错误: ${item.message}`).join('；')
    return this.error(message, 422);
  }
  serverError() { return this.error('服务器内部错误，请重试') };

  specialError(code) {
    const message = Base.code2Msg[code] || '服务器内部错误，请重试';
    return this.error(message, code);
  }

  onceSql(res) {
    // 隐藏函数，对于只执行一次Service函数就能得到可用的response时，可以调用这个函数，少写很多字符
    const { success, data, message } = res;
    success ? this.success(data) : this.error(message);
  }
}

BaseController.code2Msg = {
  '401': '未登录或未授权',
  '1001': '登录已过期，请重新登录',
  '1002': '登录已过期，请重新登录222',
};

module.exports = BaseController;