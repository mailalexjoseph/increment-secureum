// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

/// @dev Contract https://github.com/curvefi/curve-crypto-contract/blob/master/deployment-logs/2021-11-01.%20EURS%20on%20mainnet/CryptoSwap.vy
interface ICryptoSwap {
    function get_virtual_price() external view returns (uint256);

    function price_oracle() external view returns (uint256);

    function balances(uint256 i) external view returns (uint256);

    // Swap token i to j with amount dx and min amount min_dy
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);

    function get_dy(
        uint256 i,
        uint256 j,
        uint256 dx
    ) external view returns (uint256);

    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount) external returns (uint256); // WARNING: Has to be memory to be called within the perpetual contract, but you should use calldata

    function remove_liquidity(uint256 _amount, uint256[2] memory min_amounts) external; // WARNING: Has to be memory to be called within the perpetual contract, but you should use calldata

    function last_prices() external view returns (uint256);

    function token() external view returns (address);
}
