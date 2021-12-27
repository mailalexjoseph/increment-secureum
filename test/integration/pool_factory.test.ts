import {ethers} from 'hardhat';
import curveFactoryAbi from '../../contracts-vyper/abi/curve-factory-v2.json';
import curveCryptoSwapAbi from '../../contracts-vyper/abi/curve-crypto-swap-v2.json';

const CURVE_FACTORY_MAINNET_ADDRESS =
  '0xB9fC157394Af804a3578134A6585C0dc9cc990d4';
const ZERO_ADDRESS = ethers.utils.getAddress(
  '0x0000000000000000000000000000000000000000'
);
const oneUnit = ethers.utils.parseEther('1');

const unlimitedGasParams = {gasPrice: 100000, gasLimit: 100000};

/// @note The current factory contract can only deploy v1 pools (21/12/2021)
/// @notice Script was written based on (https://discord.com/channels/729808684359876718/729812922649542758/921088270270595153)
/// @dev: Should we just delete this test for now?
describe('Pool test', () => {
  it('Curve pool interaction', async () => {
    const [owner] = await ethers.getSigners();

    console.log(`Owner balance: ${await owner.getBalance()}`);

    // deploy and mint some tokens
    const vBaseFactory = await ethers.getContractFactory('VBase', owner);
    const vQuoteFactory = await ethers.getContractFactory('VQuote', owner);
    const vBase = await vBaseFactory.deploy('vBase', 'vBase');
    const vQuote = await vQuoteFactory.deploy('vUSD', 'vUSD');
    await vBase.mint(oneUnit);
    await vQuote.mint(oneUnit);

    // create the curve pool
    const curveFactory = await ethers.getContractAt(
      curveFactoryAbi,
      CURVE_FACTORY_MAINNET_ADDRESS,
      owner
    );
    await curveFactory[
      'deploy_plain_pool(string,string,address[4],uint256,uint256)'
    ](
      'Test pool',
      'TEST',
      [vBase.address, vQuote.address, ZERO_ADDRESS, ZERO_ADDRESS],
      50,
      4000000
    );

    const poolAddress = await curveFactory[
      'find_pool_for_coins(address,address)'
    ](vBase.address, vQuote.address);

    // the one used in 0x5F890841f657d90E081bAbdB532A05996Af79Fe6
    const poolAbi = JSON.stringify(curveCryptoSwapAbi);
    const pool = new ethers.Contract(poolAddress, poolAbi, owner);

    // add liquidity
    await vBase.approve(pool.address, await vBase.balanceOf(owner.address));
    await vQuote.approve(pool.address, await vQuote.balanceOf(owner.address));
    await pool['add_liquidity(uint256[2],uint256)'](
      [
        (await vBase.balanceOf(owner.address)).div(4),
        (await vQuote.balanceOf(owner.address)).div(4),
      ],
      0
    );

    // // get_dy, exchange test (should not fail)
    const getDyRes = await pool['get_dy(uint256,uint256,uint256)'](1, 0, 1000);
    console.log(`-----`);
    console.log(`get_dy result`);
    console.log(getDyRes.toString());
    console.log(`-----`);

    const exchangeRes = await pool['exchange(uint256,uint256,uint256,uint256)'](
      1,
      0,
      1000,
      0
    );
    console.log(`-----`);
    console.log(`exchange result`);
    console.log(exchangeRes.toString());
    console.log(`-----`);
  });
});
