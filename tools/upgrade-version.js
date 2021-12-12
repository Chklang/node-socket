const fs = require('fs');
const { promisify } = require('util');

const upgradeLevel = process.argv[2] || 'patch';
const packageName = 'ptmyway-stc-v2';

const readdir = promisify(fs.readdir);
const lstat = promisify(fs.lstat);
readdir('./libs')
  .then((result) =>
    Promise.all(
      result.map((e) => lstat('./libs/' + e).then((stat) => ({ isDirectory: stat.isDirectory(), path: './libs/' + e })))
    )
  )
  .then((results) => results.filter((e) => e.isDirectory).map((e) => e.path))
  .then((dirs) => {
    console.log('Upgrade main version...');

    dirs.push('.');
    dirs.forEach((dir) => {
      console.log(`\nUpgrade ${upgradeLevel} version of ${dir}:`);

      try {
        const packageJson = JSON.parse(fs.readFileSync(`${dir}/package.json`));

        const semver = /(\d*?)\.(\d*?)\.(\d*)/.exec(packageJson.version || '0.0.0');

        let version;

        if (upgradeLevel === 'major') {
          version = `${Number(semver[1]) + 1}.0.0`;
        } else if (upgradeLevel === 'minor') {
          version = `${semver[1]}.${Number(semver[2]) + 1}.0`;
        } else {
          version = `${semver[1]}.${semver[2]}.${Number(semver[3]) + 1}`;
        }

        packageJson.version = version;
        fs.writeFileSync(`${dir}/package.json`, JSON.stringify(packageJson, null, 4));

        console.log(`\nUpgrade ${dir} to ${version}`);
      } catch (e) {
        console.error(e);
      }
    });

    console.log('\n');
    console.log('Upgrade version...');

    dirs.forEach((dir) => {
      console.log(`\nUpgrade dependencies version of ${dir}:`);

      try {
        const packageJson = JSON.parse(fs.readFileSync(`${dir}/package.json`));

        if (packageJson.dependencies) {
          Object.keys(packageJson.dependencies).forEach((dependency) => {
            if (dependency.indexOf('@' + packageName + '/') >= 0) {
              const library = dependency.replace('@' + packageName + '/', '');
              const version = getLibraryVersion(library);

              packageJson.dependencies[dependency] = version;
              console.log(`${dependency} => ${version}:`);
            }
          });
        }
        if (packageJson.peerDependencies) {
          Object.keys(packageJson.peerDependencies).forEach((dependency) => {
            if (dependency.indexOf('@' + packageName + '/') >= 0) {
              const library = dependency.replace('@' + packageName + '/', '');
              const version = getLibraryVersion(library);

              packageJson.peerDependencies[dependency] = '^' + version;
              console.log(`${dependency} => ${version}:`);
            }
          });
        }
        fs.writeFileSync(`${dir}/package.json`, JSON.stringify(packageJson, null, 4));
      } catch (e) {
        console.error(e);
      }
    });
  });

function getLibraryVersion(library) {
  const file = editJsonFile(`libs/${library}/package.json`);
  return file.get('version') || '0.0.0';
}
