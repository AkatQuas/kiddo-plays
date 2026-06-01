const { packNpm } = require('./mini-ext-pack/dist');

const rootPath = process.argv[2]
process.chdir(rootPath)
packNpm(
  {
    rootPath,
    isWatch: false,
  },
  (err, info) => {
    if (err) {
      console.log(
        `%c***** err *****`,
        'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
        '\n',
        { err },
        '\n'
      );
      process.exit(1);
    }

    console.log(
      `%c***** info *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      info,
      '\n'
    );
  }
);
