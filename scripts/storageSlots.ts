import {findBalancesSlot} from '../helpers/bruteForceBalance';

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

async function main() {
  const balanceStorageSlot = await findBalancesSlot(USDC_ADDRESS);
  console.log('USDC balance storage slot:', balanceStorageSlot);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });