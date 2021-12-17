// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

/// @dev Contract https://github.com/curvefi/curve-crypto-contract/blob/master/contracts/two/CurveCryptoSwap2.vy
interface ICryptoSwap {
    function totalSupply() external view returns (uint256);

    function balances(uint256 i) external view returns (uint256);

    function A() external view returns (uint256);

    function gamma() external view returns (uint256);

    function fee() external view returns (uint256);

    function get_virtual_price() external view returns (uint256);

    function calc_token_amount(uint256[] calldata amounts) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 token_amount, uint256 i) external pure returns (uint256);

    function claim_admin_fees() external;

    function ramp_A_gamma(
        uint256 future_A,
        uint256 future_gamma,
        uint256 future_time
    ) external;

    function stop_ramp_A_gamma() external;

    // Swap token i to j with amount dx and min amount min_dy
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);

    function get_dy(
        uint256 i,
        uint256 j,
        uint256 dx
    ) external returns (uint256);

    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount) external returns (uint256);

    function remove_liquidity(uint256 _amount, uint256[2] calldata min_amounts) external returns (uint256[2] memory);

    function remove_liquidity_one_coin(
        uint256 token_amount,
        uint256 i,
        uint256 min_amount
    ) external returns (uint256);

    function commit_new_parameters(
        uint256 _new_mid_fee,
        uint256 _new_out_fee,
        uint256 _new_admin_fee,
        uint256 _new_fee_gamma,
        uint256 _new_allowed_extra_profit,
        uint256 _new_adjustment_step,
        uint256 _new_ma_half_time
    ) external;

    function apply_new_parameters() external;

    function revert_new_parameters() external;

    function commit_transfer_ownership(address _owner) external;

    function apply_transfer_ownership() external;

    function revert_transfer_ownership() external;

    function kill_me() external;

    function unkill_me() external;

    function set_admin_fee_receiver(address _admin_fee_receiver) external;
}
