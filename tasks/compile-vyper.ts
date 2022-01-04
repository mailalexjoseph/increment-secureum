import fs from 'fs';
import path from 'path';

import {task, subtask} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

// @dev: Performs 5 steps:
// 1) copies files from the contract-dependencies folder to the contract folder
// 2) compiles the contract
// 3) remove the contract-dependencies folder from src/
// 4) copy the artifacts & typechain objects
// 5) clean up the artifacts and typechain objects by recompiling

// @note Could get depreciated once https://github.com/nomiclabs/hardhat/issues/1258 is
// @note Does not resolve https://github.com/nomiclabs/hardhat/issues/1696

task('compile-vyper', 'Compiles vyper contracts and copy to folder')
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    await hre.run('copy-contracts', {directory: taskArgs.directory});
    await hre.run('compile');
    await hre.run('remove-contract-copies', {
      directory: taskArgs.directory,
    });
    await hre.run('copy-artifacts', {directory: taskArgs.directory});
    await hre.run('typechain');
    await hre.run('remove-artifacts', {directory: taskArgs.directory});
    await hre.run('copy-typechain', {directory: taskArgs.directory});
    await hre.run('clean');
    await hre.run('typechain');
  });

subtask('copy-contracts', 'Copy the contract files to the contracts folder')
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const inFullPath = path.resolve(
      hre.config.paths.root,
      path.join(taskArgs.directory, './contracts')
    );

    // create destination folder
    const outDirectoryFullPath = path.resolve(
      hre.config.paths.sources,
      taskArgs.directory
    );
    fs.mkdirSync(outDirectoryFullPath, {recursive: true});

    // copies all .vy files from contracts-vyper/contracts/
    fs.readdirSync(inFullPath).forEach((file) => {
      if (file.endsWith('.vy')) {
        if (file != 'CurveTokenV5.vy') {
          console.log('Found file: ', file);
          fs.copyFileSync(
            path.resolve(inFullPath, file),
            path.join(outDirectoryFullPath, file)
            // fs.constants.COPYFILE_EXCL // replace existing file
          );
        } else {
          console.log(
            'Skipping file:' +
              file +
              ' because generated typechain object is broken'
          );
        }
      }
    });
  });

subtask(
  'remove-contract-copies',
  'Remove the vyper contracts from the contracts folder'
)
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // clean up
    fs.rmSync(path.resolve(hre.config.paths.sources, taskArgs.directory), {
      recursive: true,
    });
  });

subtask('copy-artifacts', 'Copy the artifacts to contracts-vyper folder')
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    _copyFolderSync(
      path.resolve(
        hre.config.paths.artifacts,
        path.join('./contracts', taskArgs.directory)
      ),
      path.resolve(
        hre.config.paths.root,
        path.join(taskArgs.directory, './artifacts')
      )
    );
  });

subtask(
  'remove-artifacts',
  'Remove the vyper artifacts from the artifacts folder'
)
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    // clean up
    fs.rmSync(
      path.resolve(
        hre.config.paths.artifacts,
        path.join('./contracts', taskArgs.directory)
      ),
      {recursive: true}
    );
  });

subtask(
  'copy-typechain',
  'Copy the typechain objects to contracts-vyper folder'
)
  .addParam('directory', 'The directory where the vyper contracts are located')
  .setAction(async (taskArgs) => {
    // get all vyper artifacts
    fs.readdirSync(path.join(taskArgs.directory, './artifacts')).forEach(
      (file) => {
        if (file.endsWith('.vy')) {
          const contract = [file.split('.')[0], '.ts'].join('');

          if (file != 'CurveTokenV5.vy') {
            fs.copyFileSync(
              path.resolve('./typechain', contract),
              path.resolve(
                taskArgs.directory,
                path.join('./typechain', contract)
              )
            );

            const factory = [file.split('.')[0], '__factory.ts'].join('');
            fs.copyFileSync(
              path.resolve('./typechain/factories', factory),
              path.resolve(
                taskArgs.directory,
                path.join('./typechain/factories', factory)
              )
            );
          } else {
            console.log(
              'Skipping file:' +
                file +
                ' because generated typechain object is broken'
            );
          }
        }
      }
    );
  });

// @note Copies folder recursively
// https://stackoverflow.com/questions/13786160/copy-folder-recursively-in-node-js/26038979
function _copyFolderSync(from: string, to: string) {
  if (!fs.existsSync(to)) fs.mkdirSync(to);
  fs.readdirSync(from).forEach((element) => {
    if (fs.lstatSync(path.join(from, element)).isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else {
      _copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}
