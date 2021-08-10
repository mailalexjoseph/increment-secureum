import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {utils, BigNumber} from 'ethers';
import {Perpetual, ERC20} from '../typechain';

describe('Increment App: Scenario', function () {
  let bob: any, alice: any;
  let perpetual: Perpetual, usdc: ERC20;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({perpetual, usdc, bob, alice} = await setup());

    // deposit funds into contract
    depositAmount = await funding();
    await bob.usdc.approve(perpetual.address, depositAmount);
    await bob.perpetual.deposit(depositAmount, usdc.address);
    await alice.usdc.approve(perpetual.address, depositAmount);
    await alice.perpetual.deposit(depositAmount, usdc.address);
  });

  describe('Can handle multiple trader on vAMM', function () {
    it('Bob should go long JPYUSD and Alice should go long JPYUSD', async function () {
      /********** mint assets *************/

      // Bob
      const mintAmountBob = utils.parseEther('500');
      await expect(bob.perpetual.MintLongQuote(mintAmountBob))
        .to.emit(perpetual, 'buyQuoteLong')
        .withArgs(
          mintAmountBob,
          bob.address,
          utils.parseEther('55524.708495280399777902')
        );

      // Alice
      const mintAmountAlice = utils.parseEther('1000');
      await expect(alice.perpetual.MintLongQuote(mintAmountAlice))
        .to.emit(perpetual, 'buyQuoteLong')
        .withArgs(
          mintAmountAlice,
          alice.address,
          utils.parseEther('110864.642586250382252049')
        );

      const bobPnL = await perpetual.getUnrealizedPnL(bob.address);
      console.log('Bob has so much PnL', utils.formatEther(bobPnL.value));
      /********** redeem assets *************/
      // Bob
      await expect(bob.perpetual.RedeemLongQuote(usdc.address))
        .to.emit(perpetual, 'sellQuoteLong')
        .withArgs(
          utils.parseEther('55524.708495280399777902'),
          bob.address,
          usdc.address
        );
      expect(
        await perpetual.getReserveBalance(bob.address, usdc.address)
      ).to.be.equal(utils.parseEther('101.110801784312075184'));

      // Alice
      await expect(alice.perpetual.RedeemLongQuote(usdc.address))
        .to.emit(perpetual, 'sellQuoteLong')
        .withArgs(
          utils.parseEther('110864.642586250382252049'),
          alice.address,
          usdc.address
        );
      expect(
        await perpetual.getReserveBalance(alice.address, usdc.address)
      ).to.be.equal(utils.parseEther('98.889198215687924816'));
    });
  });
});
