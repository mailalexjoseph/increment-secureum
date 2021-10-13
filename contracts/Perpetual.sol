// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {LibFunding} from "./lib/LibFunding.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

contract stubPerpetual is IPerpetual {
    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    Price[] prices;

    function getAllPeriods() public view override returns (uint256) {
        return prices.length;
    }

    function getLatestPrice() public view override returns (Price memory) {
        uint256 numPeriods = getAllPeriods();
        return prices[numPeriods];
    }

    function getPrice(uint256 _period) public view override returns (Price memory) {
        return prices[_period];
    }

    function setPrice(Price memory _newPrice) public {
        prices.push(_newPrice);
    }
}
