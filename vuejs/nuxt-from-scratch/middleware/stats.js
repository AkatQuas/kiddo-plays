import axios from 'axios';

export default ({ route}) => {
    return axios.post('http://httpbin.org/post', {
        url: route.fullPath
    })
}