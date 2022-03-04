import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {asBigNumber} from '../test/helpers/utils/calculations';

const currentTimeStamp = BigNumber.from('1646402478');
const eurPrice = asBigNumber('1000');
const maxInt256 = ethers.constants.MaxInt256;

const oTimeStamp = (
  maxNum: BigNumber,
  price: BigNumber,
  timeStamp: BigNumber
) => maxNum.div(price).add(timeStamp);

const main = function () {
  /* An overflow happens when
      (oTimeStamp - currentTimeStamp) * eurPrice > maxInt256
  <=>  oTimeStamp                                > maxInt256 / eurPrice + currentTimeStamp
  */

  const oTimeStampOverflow = oTimeStamp(maxInt256, eurPrice, currentTimeStamp);

  console.log('TimeStamp overflow is : ', oTimeStampOverflow.toString());

  console.log('Date of overflow is Monday, August 27, 3804 2:36:58.658 AM'); // from: https://www.epochconverter.com/
};

main();
