const {
  address,
  etherMantissa,
  encodeParameters,
} = require('../Utils/Ethereum');
const {
  makeController,
  makePToken, makeDistributor,
} = require('../Utils/DeFiPie');

const BigNumber = require('bignumber.js');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('DeFiPieLens', () => {
  let defipieLens, acct;

  beforeEach(async () => {
    defipieLens = await deploy('DeFiPieLens');
    acct = accounts[0];
  });

  describe('pTokenMetadata', () => {
    it('is correct for a pErc20', async () => {
      let pErc20 = await makePToken();
      expect(
        cullTuple(await call(defipieLens, 'pTokenMetadata', [pErc20._address]))
      ).toEqual(
        {
          pToken: pErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "100000000000000000",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(pErc20, 'underlying', []),
          pTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for pEth', async () => {
      let pEth = await makePToken({kind: 'pether', exchangeRate: 1});
      expect(
        cullTuple(await call(defipieLens, 'pTokenMetadata', [pEth._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        pToken: pEth._address,
        pTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "10000000000000000000000000000",
        isListed: true,
        reserveFactorMantissa: "100000000000000000",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('pTokenMetadataAll', () => {
    it('is correct for a pErc20 and pEther', async () => {
      let pErc20 = await makePToken();
      let pEth = await makePToken({kind: 'pether', exchangeRate: 1});
      expect(
        (await call(defipieLens, 'pTokenMetadataAll', [[pErc20._address, pEth._address]])).map(cullTuple)
      ).toEqual([
        {
          pToken: pErc20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "100000000000000000",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed: true,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(pErc20, 'underlying', []),
          pTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          pToken: pEth._address,
          pTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "10000000000000000000000000000",
          isListed: true,
          reserveFactorMantissa: "100000000000000000",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('pTokenBalances', () => {
    it('is correct for pErc20', async () => {
      let pErc20 = await makePToken();
      expect(
        cullTuple(await call(defipieLens, 'pTokenBalances', [pErc20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          pToken: pErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for pETH', async () => {
      let pEth = await makePToken({kind: 'pether', exchangeRate: 1});
      let ethBalance = await web3.eth.getBalance(acct);

      expect(
        cullTuple(await call(defipieLens, 'pTokenBalances', [pEth._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          pToken: pEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      );
    });
  });

  describe('pTokenBalancesAll', () => {
    it('is correct for pEth and pErc20', async () => {
      let pErc20 = await makePToken();
      let pEth = await makePToken({kind: 'pether'});
      let ethBalance = await web3.eth.getBalance(acct);

      expect(
        (await call(defipieLens, 'pTokenBalancesAll', [[pErc20._address, pEth._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          pToken: pErc20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          pToken: pEth._address,
          tokenAllowance: ethBalance,
          tokenBalance: ethBalance,
        }
      ]);
    })
  });

  describe('pTokenUnderlyingPrice', () => {
    it('gets correct price for pErc20', async () => {
      let pErc20 = await makePToken();
      expect(
        cullTuple(await call(defipieLens, 'pTokenUnderlyingPrice', [pErc20._address]))
      ).toEqual(
        {
          pToken: pErc20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for pEth', async () => {
      let pEth = await makePToken({kind: 'pether'});

      expect(
        cullTuple(await call(defipieLens, 'pTokenUnderlyingPrice', [pEth._address]))
      ).toEqual(
        {
          pToken: pEth._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('pTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let pErc20 = await makePToken();
      let pEth = await makePToken({kind: 'pether'});
      expect(
        (await call(defipieLens, 'pTokenUnderlyingPriceAll', [[pErc20._address, pEth._address]])).map(cullTuple)
      ).toEqual([
        {
          pToken: pErc20._address,
          underlyingPrice: "0",
        },
        {
          pToken: pEth._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let controller = await makeController();

      expect(
        cullTuple(await call(defipieLens, 'getAccountLimits', [controller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let pie, ppie, registryAddress, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let threshold = new BigNumber(15000001e18); //15,000,000e18, 1e8 ppie = 1e18 pie

    beforeEach(async () => {
      pie = await deploy('Pie', [acct]);
      ppie = await makePToken({ kind: 'ppie', underlying: pie, exchangeRate: 1});
      registryAddress = await call(ppie, 'registry');
      gov = await deploy('Governor', [address(0), registryAddress, address(0), '19710']);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];

      await send(pie, 'approve', [ppie._address, threshold]);
      await send(ppie, 'mint', [threshold]);
      await send(ppie, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(defipieLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(defipieLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + 19711).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + 1).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('pie and ppie', () => {
    let pie, ppie, currentBlock;

    beforeEach(async () => {
      pie = await deploy('Pie', [acct]);
      ppie = await makePToken({ kind: 'ppie', underlying: pie, exchangeRate: 1});
      await send(pie, 'approve', [ppie._address, etherMantissa(10000000)]);
      currentBlock = +(await web3.eth.getBlockNumber());
      await send(ppie, 'mint', [etherMantissa(10000000)]);
    });

    describe('getPPieBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(defipieLens, 'getPPieBalanceMetadata', [ppie._address, acct]))
        ).toEqual({
          balance: "1000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getPPieBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let distributor = await makeDistributor();
        await send(distributor, 'setPieAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(defipieLens, 'getPPieBalanceMetadataExt', [ppie._address, distributor._address, acct]))
        ).toEqual({
          balance: "1000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getPPieVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(defipieLens, 'getPPieVotes', [ppie._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(defipieLens, 'getPPieVotes', [ppie._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert PPie::getPriorVotes: not yet determined')
      });
    });
  });
});
