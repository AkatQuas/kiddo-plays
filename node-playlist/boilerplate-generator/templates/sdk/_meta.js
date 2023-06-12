module.exports = {
  inputs: {
    name: {
      message: 'What the name of SDK',
      validate: (v) => {
        if (!v) {
          return false;
        }
        return true;
      },
    },
  },
  metadata: {
    scope: '@boilerplate',
  },
};
