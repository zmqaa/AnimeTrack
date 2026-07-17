const path = require('path');

const { syncNativeModules } = require('./sync-native-modules');

module.exports = async function afterPack(context) {
  const targetNodeModules = path.join(
    context.appOutDir,
    'resources',
    'app',
    'standalone',
    'server_node_modules',
  );
  syncNativeModules(targetNodeModules);
  console.log(`[desktop] 已为 ${context.electronPlatformName}-${context.arch} 同步原生模块`);
};
