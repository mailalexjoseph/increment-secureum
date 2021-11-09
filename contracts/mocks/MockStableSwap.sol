// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/// @notice Mock StableSwap market to test buying/selling of derivative toknens
/// @dev Uses the well-known x * y = k formula

contract MockStableSwap {
    struct Pool {
        uint256 vQuote;
        uint256 vBase;
        uint256 totalAssetReserve;
        uint256 price; // 10 ** 18
    }

    uint256 constant DECIMALS = 10**18;
    Pool public pool;

    constructor(uint256 _vQuote, uint256 _vBase) {
        pool.vQuote = _vQuote;
        pool.vBase = _vBase;
        pool.totalAssetReserve = _vQuote * _vBase;
        pool.price = (_vBase * DECIMALS) / _vQuote;
    }

    /************************* events *************************/
    event NewReserves(uint256 vBase, uint256 vQuote, uint256 newPrice, uint256 blockNumber);

    /************************* functions *************************/

    /* mint vBase to go long euro */
    function _mintVBase(uint256 amount) internal returns (uint256) {
        uint256 vBasenew = pool.vBase + amount;
        uint256 vQuoteNew = pool.totalAssetReserve / vBasenew; // x = k / y
        uint256 buy = pool.vQuote - vQuoteNew;

        _updateBalances(vBasenew, vQuoteNew);

        return buy;
    }

    /* burn vBase to go short euro */
    function _burnVBase(uint256 amount) internal returns (uint256) {
        uint256 vBasenew = pool.vBase - amount;
        uint256 vQuoteNew = pool.totalAssetReserve / vBasenew; // x = k / y
        uint256 buy = vQuoteNew - pool.vQuote;
        _updateBalances(vBasenew, vQuoteNew);

        return buy;
    }

    /* mint vQuote to close long euro */
    function _mintVQuote(uint256 amount) internal returns (uint256) {
        uint256 vQuoteNew = pool.vQuote + amount;
        uint256 vBasenew = pool.totalAssetReserve / vQuoteNew; // x = k / y
        uint256 sell = pool.vBase - vBasenew;

        _updateBalances(vBasenew, vQuoteNew);

        return sell;
    }

    /* burn vQuote to close short euro */
    function _burnVQuote(uint256 amount) internal returns (uint256) {
        uint256 vQuoteNew = pool.vBase - amount;
        uint256 vBasenew = pool.totalAssetReserve / vQuoteNew; // x = k / y
        uint256 sell = vBasenew - pool.vBase;

        _updateBalances(vBasenew, vQuoteNew);

        return sell;
    }

    /* update reserve balances after buying/selling */
    function _updateBalances(uint256 _vBaseNew, uint256 _vQuoteNew) internal {
        uint256 newPrice = (_vBaseNew * DECIMALS) / _vQuoteNew;

        //console.log("vamm state before is", pool.price, pool.vBase, pool.vEUR);
        pool.price = newPrice;
        pool.vBase = _vBaseNew;
        pool.vQuote = _vQuoteNew;

        //console.log("vamm state after is", pool.price, pool.vBase, pool.vEUR);
        emit NewReserves(_vBaseNew, _vQuoteNew, newPrice, block.number);
    }
}
