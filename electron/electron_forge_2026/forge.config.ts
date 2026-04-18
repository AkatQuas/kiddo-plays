import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import 'zx/globals';

const USE_ASAR = Boolean(process.env.USE_ASAR);

const config: ForgeConfig = {
  packagerConfig: {
    asar: USE_ASAR,
    prune: true,
    extraResource: [],
    appCategoryType: 'public.app-category.productivity',
    // App icon - without file extension (Electron will look for appropriate format)
    // Place icons in resources/icons/ directory
    // - icon.ico for Windows
    // - icon.icns for macOS
    icon: './resources/icons/icon',
    appBundleId: 'com.electron.app',
    // https://www.electronforge.io/guides/code-signing/code-signing-macos#osxsign-options
    osxSign: process.env.SIGN_APP ? {} : undefined,
    // https://www.electronforge.io/guides/code-signing/code-signing-macos#option-1-using-an-app-specific-password
    osxNotarize: process.env.NOTARIZE_APP
      ? {
          appleId: process.env.APPLE_ID as string,
          appleIdPassword: process.env.APPLE_PASSWORD as string,
          teamId: process.env.APPLE_TEAM_ID as string
        }
      : undefined
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // certificateFile: '',
      // certificatePassword: process.env.CERTIFICATE_PASSWORD
    }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({})
  ],
  hooks: {
    prePackage: async () => {},
    readPackageJson: async (_forgeConfig, pkg) => {
      const productionPkg = {
        name: pkg.name,
        productName: pkg.productName,
        version: pkg.version,
        description: pkg.description,
        main: pkg.main,
        private: pkg.private,
        dependencies: pkg.dependencies,
        devDependencies: {
          electron: pkg.devDependencies.electron
        }
      };
      return productionPkg;
    },
    packageAfterCopy: async (_, _buildPath) => {
      // const deps = Object.keys(pkgJSON.dependencies || {});
      // for (const dep of deps) {
      //   const src = path.join(__dirname, 'node_modules', dep);
      //   const dest = path.join(buildPath, 'node_modules', dep);
      //   if (await fs.pathExists(src)) {
      //     await fs.copy(src, dest, { dereference: true });
      //   }
      // }
    }
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.mts',
          target: 'main'
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload'
        }
      ],
      // https://www.electronforge.io/config/plugins/vite#hot-module-replacement-hmr
      renderer: [
        {
          name: 'main_window',
          config: 'vite.main_window.config.mts'
        },
        {
          name: 'lite_window',
          config: 'vite.lite_window.config.mts'
        }
      ]
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: USE_ASAR
    })
  ]
};

export default config;
