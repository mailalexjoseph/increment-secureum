
/** 
 *  SourceUnit: /home/markus/projects/Increment-Finance/increment-protocol/contracts/misc/PerpetualDataProvider.sol
*/
            
////// SPDX-License-Identifier-FLATTEN-SUPPRESS-WARNING: MIT

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * ////IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}




/** 
 *  SourceUnit: /home/markus/projects/Increment-Finance/increment-protocol/contracts/misc/PerpetualDataProvider.sol
*/
            
////// SPDX-License-Identifier-FLATTEN-SUPPRESS-WARNING: MIT

pragma solidity ^0.8.0;

////import "../IERC20.sol";

/**
 * @dev Interface for the optional metadata functions from the ERC20 standard.
 *
 * _Available since v4.1._
 */
interface IERC20Metadata is IERC20 {
    /**
     * @dev Returns the name of the token.
     */
    function name() external view returns (string memory);

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() external view returns (string memory);

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() external view returns (uint8);
}




/** 
 *  SourceUnit: /home/markus/projects/Increment-Finance/increment-protocol/contracts/misc/PerpetualDataProvider.sol
*/
            
////// SPDX-License-Identifier-FLATTEN-SUPPRESS-WARNING: MIT
pragma solidity 0.8.4;

/// @notice Describes all complex types

library PerpetualTypes {
    struct UserPosition {
        mapping(address => uint256) userReserve;
        uint256 quoteLong;
        uint256 q;
        uint256 usdNotional;
    }

    struct Index {
        uint256 blockNumber;
        uint256 value;
        bool isPositive;
    }

    struct Int {
        uint256 value;
        bool isPositive;
    }

    struct Pool {
        uint256 vQuote;
        uint256 vBase;
        uint256 totalAssetReserve;
        uint256 price; // 10 ** 18
    }

    struct Price {
        uint256 price;
        uint256 time;
        uint80 id;
    }
}

interface IPerpetual {
    function MintLongQuote(uint256 _amount) external returns (uint256);

    function MintLongWithLeverage(uint8 _leverage) external returns (uint256);

    function MintShortQuote(uint256 _amount) external returns (uint256);

    function MintShortWithLeverage(uint8 _leverage) external returns (uint256);

    function RedeemLongQuote(address _redeemAsset) external returns (uint256);

    function RedeemShortQuote(address _redeemAsset) external returns (uint256);

    function _TOKENS_(uint256) external view returns (address);

    function _getFundingRate() external view returns (PerpetualTypes.Index memory);

    function allowWithdrawal(
        address account,
        address _token,
        uint256 _amount
    ) external view returns (bool);

    function balances(address)
        external
        view
        returns (
            uint256 quoteLong,
            uint256 quoteShort,
            uint256 usdNotional
        );

    function deposit(uint256 _amount, address _token) external;

    function getAssetOracle(address _asset) external view returns (address);

    function getAssetPrice(address _oracleAddress) external view returns (uint256);

    function getAssetPriceByTokenAddress(address _tokenAddress) external view returns (uint256);

    function getAssetValue(address account, address token) external view returns (uint256);

    function getEntryPrice(address account) external view returns (uint256);

    function getFundingRate() external view returns (PerpetualTypes.Index memory);

    function getLongBalance(address account) external view returns (uint256);

    function getPnl(address account) external view returns (uint256);

    function getPoolInfo() external view returns (PerpetualTypes.Pool memory);

    function getPoolPrice() external view returns (uint256);

    function getPortfolioValue(address account) external view returns (uint256);

    function getQuoteAssetOracle() external view returns (address);

    function getReserveAssets() external view returns (address[] memory);

    function getReserveBalance(address account, address _token) external view returns (uint256);

    function getShortBalance(address account) external view returns (uint256);

    function getUnrealizedPnL(address account) external view returns (PerpetualTypes.Int memory);

    function getUserMarginRatio(address account) external view returns (uint256);

    function getUserNotional(address account) external view returns (uint256);

    function getVAMMsnapshots(uint256 _id) external view returns (PerpetualTypes.Price memory);

    function global_index()
        external
        view
        returns (
            uint256 blockNumber,
            uint256 value,
            bool isPositive
        );

    function index(address)
        external
        view
        returns (
            uint256 blockNumber,
            uint256 value,
            bool isPositive
        );

    function owner() external view returns (address);

    function pool()
        external
        view
        returns (
            uint256 vQuote,
            uint256 vBase,
            uint256 totalAssetReserve,
            uint256 price
        );

    function pushSnapshot() external;

    function renounceOwnership() external;

    function setReserveToken(
        address _asset,
        address _priceOracle,
        bool _isAToken,
        address _aaveReserve
    ) external;

    function settleAccount(address user, address _redeemAsset) external;

    function transferOwnership(address newOwner) external;

    function updateFundingRate() external;

    function withdraw(uint256 _amount, address _token) external;
}


/** 
 *  SourceUnit: /home/markus/projects/Increment-Finance/increment-protocol/contracts/misc/PerpetualDataProvider.sol
*/

////// SPDX-License-Identifier-FLATTEN-SUPPRESS-WARNING: MIT
pragma solidity 0.8.4;

////import {IPerpetual} from "../IPerpetual.sol";
////import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title A perpetual contract w/ aTokens as collateral
/// @author Markus Schick
/// @notice You can only buy one type of perpetual and only use USDC as reserve

contract PerpetualDataProvider {
    struct TokenData {
        string symbol;
        address tokenAddress;
    }

    IPerpetual public immutable perpetual;

    constructor(IPerpetual _perpetual) {
        perpetual = _perpetual;
    }

    function getAllReservesTokens() external view returns (TokenData[] memory) {
        address[] memory reserves = perpetual.getReserveAssets();
        TokenData[] memory reservesTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            reservesTokens[i] = TokenData({symbol: IERC20Metadata(reserves[i]).symbol(), tokenAddress: reserves[i]});
        }
        return reservesTokens;
    }
}

