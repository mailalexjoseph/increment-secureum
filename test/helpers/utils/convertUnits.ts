import {utils} from 'ethers';

const convertUSDCtoEther = (number: string) => {
  const numString = utils.formatUnits(number, 6);
  return utils.parseEther(numString);
};

module.exports = {convertUSDCtoEther};
