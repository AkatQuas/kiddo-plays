const HOST_URI = 'https://api.500px.com/v1/';

const PHOTOS = 'photos';
const SEARCH = '/search';
const USERS = '/users';
const SHOW_ID = '/show?id=';
const GALLERIES = '/galleries';
const COMMENTS = '/comments';
const CKEY = 'pd67OURWTmXMy6X1E3DL5jmr9aBAZ9VLjZp4jLvz';

function formatNumber(n) {
  const str = n.toString()
  return str[1] ? str : `0${str}`
}

export function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  const t1 = [year, month, day].map(formatNumber).join('/')
  const t2 = [hour, minute, second].map(formatNumber).join(':')

  return `${t1} ${t2}`
}


export function getPhotos() {
  return HOST_URI + PHOTOS;
}

export function getPhoto(id) {
  return HOST_URI + PHOTOS + '/' + id;
}

export function getConsumerKey() {
  return CKEY;
}

export function getSearch() {
  return HOST_URI + PHOTOS + SEARCH;
}

export function showUser(id) {
  return HOST_URI + USERS + SHOW_ID + id;
}

export function getUser() {
  return HOST_URI + USERS + SEARCH;
}

export function getComments(id) {
  return getPhoto(id) + COMMENTS;
}

export function isNone(s) {
  return s == '' || s == null || s == undefined;
}


export default {
  formatNumber,
  formatTime,
  getPhotos,
  getConsumerKey,
  getPhoto,
  getSearch,
  showUser,
  getUser,
  isNone,
  getComments
}
