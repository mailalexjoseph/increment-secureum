# TestLibFunding









## Methods

### calculateFunding

```solidity
function calculateFunding(int256 marketPrice, int256 indexPrice, uint256 currentTime, uint256 TWAP_FREQUENCY) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| marketPrice | int256 | undefined
| indexPrice | int256 | undefined
| currentTime | uint256 | undefined
| TWAP_FREQUENCY | uint256 | undefined

### getGlobalPosition

```solidity
function getGlobalPosition() external view returns (struct LibPerpetual.GlobalPosition)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.GlobalPosition | undefined

### globalPosition

```solidity
function globalPosition() external view returns (int256 cumTradePremium, uint128 timeOfLastTrade, uint128 timeStamp, int256 premium, int256 cumFundingRate)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| cumTradePremium | int256 | undefined
| timeOfLastTrade | uint128 | undefined
| timeStamp | uint128 | undefined
| premium | int256 | undefined
| cumFundingRate | int256 | undefined

### setGlobalPosition

```solidity
function setGlobalPosition(int256 cumTradePremium, uint128 timeOfLastTrade, uint128 timeStamp, int256 premium, int256 cumFundingRate) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| cumTradePremium | int256 | undefined
| timeOfLastTrade | uint128 | undefined
| timeStamp | uint128 | undefined
| premium | int256 | undefined
| cumFundingRate | int256 | undefined




## Errors

### PRBMathSD59x18__DivInputTooSmall

```solidity
error PRBMathSD59x18__DivInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.




### PRBMathSD59x18__DivOverflow

```solidity
error PRBMathSD59x18__DivOverflow(uint256 rAbs)
```

Emitted when one of the intermediary unsigned results overflows SD59x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| rAbs | uint256 | undefined |

### PRBMathSD59x18__MulInputTooSmall

```solidity
error PRBMathSD59x18__MulInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.




### PRBMathSD59x18__MulOverflow

```solidity
error PRBMathSD59x18__MulOverflow(uint256 rAbs)
```

Emitted when the intermediary absolute result overflows SD59x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| rAbs | uint256 | undefined |

### PRBMath__MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |

### PRBMath__MulDivOverflow

```solidity
error PRBMath__MulDivOverflow(uint256 prod1, uint256 denominator)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |
| denominator | uint256 | undefined |


