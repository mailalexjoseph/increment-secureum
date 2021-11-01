// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {LibFunding} from "./LibFunding.sol";
import {IPerpetual} from "./interfaces/Perpetual/IPerpetual.sol";

contract stubPerpetual is IPerpetual {

    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    struct Price {
        uint128 roundId;
        uint128 timeStamp;
        int256 price;
    }
    Price[] prices;

    function getAllPeriods() public view returns (uint256) {
        return prices.length;
    }

    function getLatestPrice() public view returns (Price memory) {
        uint256 numPeriods = getAllPeriods();
        return prices[numPeriods];
    }

    function getPrice(uint256 _period) public view returns (Price memory) {
        return prices[_period];
    }

    function setPrice(Price _newPrice) public {
        prices.push(_newPrice);
    }
}

}
