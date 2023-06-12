module.exports = () => {
  return {
    name: 'application',
    inputs: {
      name: {
        message: 'Project name',
        validate: (v) => {
          if (!v) {
            return false;
          }

          return true;
        },
      },
      version: {
        message: 'Project start version',
        default: '0.0.0',
      },
      description: {
        _type: 'editor',
        message: 'Project description',
      },
      maintainers: {
        message: 'Who are you',
      },
    },
    metadata: {
      maintainers: 'Law',
    },
  };
};
