// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {VirtualToken} from "./VirtualToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// interfaces
import {IVBase} from "../interfaces/IVBase.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/// @notice ERC20 token traded on the CryptoSwap pool
contract VBase is IVBase, VirtualToken {
    uint8 constant PRECISION = 18;

    AggregatorV3Interface public immutable aggregator;

    constructor(
        string memory _name,
        string memory _symbol,
        AggregatorV3Interface _aggregator
    ) VirtualToken(_name, _symbol) {
        require(AggregatorV3Interface(address(_aggregator)).decimals() <= PRECISION);
        aggregator = _aggregator;
    }

    function getIndexPrice() external view override returns (int256) {
        return chainlinkPrice(aggregator);
    }

    function chainlinkPrice(AggregatorV3Interface chainlinkInterface) internal view returns (int256) {
        uint8 chainlinkDecimals = chainlinkInterface.decimals();
        (, int256 price, , uint256 timeStamp, ) = chainlinkInterface.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        require(price > 0, "Integer conversion failed");
        int256 scaledPrice = (price * int256(10**(PRECISION - chainlinkDecimals)));
        return scaledPrice;
    }
}
