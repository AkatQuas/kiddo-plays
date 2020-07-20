const { remote } = require('electron');
const imageSizeOf = require('image-size');

window.onload = function () {
  console.log(42);

  const alertOnlineStatus = () => {
    console.log(navigator.onLine ? 'online' : 'offline');
  };

  window.addEventListener('online', alertOnlineStatus);
  window.addEventListener('offline', alertOnlineStatus);

  alertOnlineStatus();
};

const app = window.angular.module('app', ['ngRoute']);

app.service('imageService', function () {
  let imagePath = '';
  let dimensions = { width: 100, height: 100 };

  this.setPath = (path) => void (imagePath = path);

  this.getPath = () => imagePath;

  this.setDimensions = (inputDimensions) => {
    dimensions = inputDimensions;
  };

  this.getDimensions = () => dimensions;
});

app.config(($routeProvider) => {
  $routeProvider
    .when('/', {
      templateUrl: `${__dirname}/components/home/home.html`,
      controller: 'homeController',
    })
    .when('/edit', {
      templateUrl: `${__dirname}/components/edit/edit.html`,
      controller: 'editController',
    })
    .otherwise({
      templateUrl: `${__dirname}/components/404.html`,
    });
});

app.controller('headerController', function ($scope) {
  $scope.minimize = () => {
    const win = remote.getCurrentWindow();
    win.minimize();
  };

  $scope.maximize = () => {
    const win = remote.getCurrentWindow();
    win.isMaximized() ? win.unmaximize() : win.maximize();
  };
  $scope.close = () => {
    const win = remote.getCurrentWindow();
    win.close();
  };
});
app.controller('homeController', function ($scope, $location, imageService) {
  $scope.pickFile = function () {
    const { dialog } = remote;

    dialog
      .showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'png', 'jpeg'],
          },
        ],
      })
      .then((result) => {
        if (result.canceled) {
          // the user cancel the selection
          return;
        }
        const filePaths = result.filePaths[0];
        imageService.setPath(filePaths);
        imageService.setDimensions(imageSizeOf(filePaths));
        $location.path('/edit');
        $scope.$apply();
      })
      .catch((e) => {
        console.error('Electron failed to open file', e);
      });
  };
});

app.controller('editController', function ($scope, imageService, $location) {
  const getImageReference = () => document.getElementById('mainImage');

  const calculateStyle = () => {
    let generatedStyle = '';
    for (let i in $scope.effects) {
      const props = $scope.effects[i];
      generatedStyle += `${i}(${props.val + props.delim}) `;
    }
    return generatedStyle;
  };

  $scope.imagePath = imageService.getPath();
  $scope.controlsActive = false;
  $scope.activeEffect = '';

  $scope.effects = {
    Brightness: { val: 100, min: 0, max: 200, delim: '%' },
    Contrast: { val: 100, min: 0, max: 200, delim: '%' },
    Invert: { val: 0, min: 0, max: 100, delim: '%' },
    'Hue-Rotate': { val: 0, min: 0, max: 360, delim: 'deg' },
    Sepia: { val: 0, min: 0, max: 100, delim: '%' },
    Grayscale: { val: 0, min: 0, max: 100, delim: '%' },
    Saturate: { val: 100, min: 0, max: 200, delim: '%' },
    Blur: { val: 0, min: 0, max: 5, delim: 'px' },
  };

  $scope.hideSlider = () => {
    $scope.activeEffect = '';
    $scope.controlsActive = false;
  };

  $scope.imageEffect = (effect) => {
    $scope.controlsActive = true;
    $scope.activeEffect = effect;
  };

  $scope.setEffect = () => {
    const image = getImageReference();
    if (!image) {
      return;
    }
    image.style.filter = calculateStyle();
  };

  $scope.abort = () => {
    $location.path('/');
  };

  $scope.save = () => {
    const image = getImageReference();
    if (!image) {
      window.alert('No image to save');
      return;
    }
    const dimension = imageService.getDimensions();
    const imageSrc = imageService.getPath();
    const filterStyle = calculateStyle();
    let win = new remote.BrowserWindow({
      frame: false,
      show: true,
      width: dimension.width,
      height: dimension.height,
      webPreferences: {
        enableRemoteModule: true,
        nodeIntegration: true,
        webSecurity: false,
      },
    });

    win.loadURL(
      `data:text/html,
      <html>
      <head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"><style>*{margin: 0;padding: 0;}</style></head>
      <body>
      <p>123</p>
      <img src="${imageSrc}" style="filter:${filterStyle}" />
      <p>123end</p>
      <script>
        function screenshot (opt, cb) {
          cb = cb || function () {}
          var remote
          try {
            remote = require('' + 'electron').remote
          } catch (e) {
            remote = require('' + 'remote')
          }
          setTimeout(function () {
            remote.getCurrentWindow().capturePage(function handleCapture (img) {
              const fs = remote.require('fs');
              console.log(fs)
              fs.writeFile(opt.filename, img.toPng(), cb)
            })
          }, opt.delay || 100)
        }

        window.onload = () => {
          console.log('window loaded');
          screenshot({ filename: 'userFile.png', delay: 1000 }, (err, data) => {
            console.log(err, data)
          });
        }
      </script>
      </body>
      </html>
    `
    );
    win.webContents.openDevTools();
  };
});
