'use strict';

const success = (data) => ({
  success: true,
  data
});

const error = (message) => ({
  success: false,
  message
});

const pagination = ({ count, rows, pageSize, pageNum }) => {
  const totalPage = ~~(count / pageSize)+1;
  return success({
    total: count,
    next: pageNum < totalPage,
    pageNum,
    totalPage,
    data: rows
  })
}

module.exports = {
  success,
  error,
  pagination
};