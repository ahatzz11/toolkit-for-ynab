const glob = require('glob');
const fs = require('fs');
const path = require('path');

const LEGACY_FEATURES_DIR = path.join('src', 'extension', 'legacy', 'features');
const FEED_CHANGES_PATH = path.join(LEGACY_FEATURES_DIR, 'act-on-change', 'feedChanges.js');

glob(`${LEGACY_FEATURES_DIR}/*/**/main.js`, (error, files) => {
  if (error) { process.exit(1); }

  const featureNamePromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf8', (error, fileData) => {
        if (error) return reject(error);

        const findString = fileData.match(/^[\s]*(ynabToolKit\..+?)[\s]*=[\s]*\([\s]*function[\s]*\([\s]*\)[\s]*\{.*$/m);

        if (findString && findString[1]) {
          resolve(findString[1]);
        } else {
          resolve(null);
        }
      });
    });
  });

  Promise.all(featureNamePromises).then((featureNames) => {
    const features = featureNames.filter((name) => name && !name.includes('shared'));
    writeFeedChanges(features);
  });
});

function writeFeedChanges(features) {
  const fileContents = `
/*
  **********************************************************
  * Warning: This is a file generated by the build process. *
  *                                                         *
  * Any changes you make manually will be overwritten       *
  * the next time you run ./build or build.bat!             *
  ***********************************************************
  */

(function poll() {
  if (typeof ynabToolKit.shared !== 'undefined') {
    ynabToolKit.shared.feedChanges = function (changes) {
      ${features.map((feature, index) => (
    `${index > 0 ? '      ' : ''}try {
        if (changes.changedNodes) ${feature}.observe(changes.changedNodes);
        if (changes.routeChanged) ${feature}.onRouteChanged(changes.routeChanged);
      } catch (err) { /* ignore */ }`
  )).join('\n\n')}
    };
  } else {
    setTimeout(poll, 100);
  }
}());
`;

  fs.writeFile(FEED_CHANGES_PATH, fileContents, (error) => {
    if (error) process.exit(1);
    process.exit();
  });
}
