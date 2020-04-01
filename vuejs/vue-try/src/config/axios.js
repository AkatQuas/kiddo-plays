import axios from 'axios';
import router from '../router';


const devURL = '';
const prodURL = '';

// axios.defaults.baseURL = process.env.NODE_ENV === 'development' ? devURL : prodURL;

// axios 配置
axios.defaults.timeout = 5000;

// http request 拦截器
axios.interceptors.request.use(
    config => {
        return config;
    },
    err => {
        return Promise.reject(err);
    });

// http response 拦截器
axios.interceptors.response.use(
    response => {
        return response.data;
    },
    error => {
        for ( let x in error ) {
            console.log('http-error', x, error[x]);
        }
        if ( error.response ) {
            switch ( error.response.status ) {
                case 401:
                    // 返回 401 清除token信息并跳转到登录页面
                    router.replace({
                        name: 'Home',
                        query: { redirect: router.currentRoute.path }
                    });
                    break;
            }
        }
        // return Promise.reject(error)   // 返回接口返回的错误信息
        return Promise.reject({ data: { message: '服务器错误！' } }); //500 no response
    });

export default axios;
