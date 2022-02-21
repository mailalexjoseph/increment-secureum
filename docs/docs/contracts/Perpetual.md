# Perpetual









## Methods

### SENSITIVITY

```solidity
function SENSITIVITY() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### TWAP_FREQUENCY

```solidity
function TWAP_FREQUENCY() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### VBASE_INDEX

```solidity
function VBASE_INDEX() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### VQUOTE_INDEX

```solidity
function VQUOTE_INDEX() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### chainlinkOracle

```solidity
function chainlinkOracle() external view returns (contract IChainlinkOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IChainlinkOracle | undefined

### chainlinkTWAPOracle

```solidity
function chainlinkTWAPOracle() external view returns (contract ChainlinkTWAPOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ChainlinkTWAPOracle | undefined

### claimOwner

```solidity
function claimOwner() external nonpayable
```

`pendingOwner` can claim `owner` account.




### clearingHouse

```solidity
function clearingHouse() external view returns (contract IClearingHouse)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IClearingHouse | undefined

### closePosition

```solidity
function closePosition(address account, uint256 tentativeVQuoteAmount) external nonpayable returns (int256)
```

Closes position from account holder



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| tentativeVQuoteAmount | uint256 | Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getFundingPayments

```solidity
function getFundingPayments(address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getGlobalPosition

```solidity
function getGlobalPosition() external view returns (struct LibPerpetual.GlobalPosition)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.GlobalPosition | undefined

### getLpPosition

```solidity
function getLpPosition(address account) external view returns (struct LibPerpetual.UserPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.UserPosition | undefined

### getTraderPosition

```solidity
function getTraderPosition(address account) external view returns (struct LibPerpetual.UserPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.UserPosition | undefined

### getUnrealizedPnL

```solidity
function getUnrealizedPnL(address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### indexPrice

```solidity
function indexPrice() external view returns (int256)
```

Return the current off-chain exchange rate for vBase/vQuote




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### liquidate

```solidity
function liquidate(address liquidatee, uint256 tentativeVQuoteAmount) external nonpayable returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidatee | address | undefined
| tentativeVQuoteAmount | uint256 | Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### market

```solidity
function market() external view returns (contract ICryptoSwap)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ICryptoSwap | undefined

### marketPrice

```solidity
function marketPrice() external view returns (uint256)
```

Return the last traded price (used for TWAP)




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### marketPriceOracle

```solidity
function marketPriceOracle() external view returns (uint256)
```

Return the curve price oracle




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### openPosition

```solidity
function openPosition(address account, uint256 amount, enum LibPerpetual.Side direction) external nonpayable returns (int256, int256)
```

Open position, long or short

*No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATIONNo checks are done if bought amount exceeds allowance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| amount | uint256 | to be sold, in vQuote (if long) or vBase (if short)
| direction | enum LibPerpetual.Side | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined
| _1 | int256 | undefined

### owner

```solidity
function owner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### paused

```solidity
function paused() external view returns (bool)
```



*Returns true if the contract is paused, and false otherwise.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### pendingOwner

```solidity
function pendingOwner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### poolTWAPOracle

```solidity
function poolTWAPOracle() external view returns (contract PoolTWAPOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract PoolTWAPOracle | undefined

### provideLiquidity

```solidity
function provideLiquidity(address account, uint256 wadAmount) external nonpayable returns (uint256)
```

Provide liquidity to the pool



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | liquidity provider
| wadAmount | uint256 | amount of vQuote provided with 1e18 precision

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### removeLiquidity

```solidity
function removeLiquidity(address account, uint256 amount) external nonpayable
```

Remove liquidity from the pool (but don&#39;t close LP position and withdraw amount)



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| amount | uint256 | of liquidity to be removed from the pool (with 18 decimals)

### settleAndWithdrawLiquidity

```solidity
function settleAndWithdrawLiquidity(address account, uint256 tentativeVQuoteAmount) external nonpayable returns (int256 profit)
```

Remove liquidity from the pool (but don&#39;t close LP position and withdraw amount)



#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| tentativeVQuoteAmount | uint256 | at which to buy the LP position (if it looks like a short, more vQuote than vBase)

#### Returns

| Name | Type | Description |
|---|---|---|
| profit | int256 | undefined

### transferOwner

```solidity
function transferOwner(address recipient, bool direct) external nonpayable
```

Transfer `owner` account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | Account granted `owner` access control.
| direct | bool | If &#39;true&#39;, ownership is directly transferred.

### updateFundingRate

```solidity
function updateFundingRate() external nonpayable
```

Calculate the funding rate for the current block




### updateGenericProtocolState

```solidity
function updateGenericProtocolState() external nonpayable
```






### vBase

```solidity
function vBase() external view returns (contract IVirtualToken)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVirtualToken | undefined

### vQuote

```solidity
function vQuote() external view returns (contract IVirtualToken)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVirtualToken | undefined



## Events

### ClosePosition

```solidity
event ClosePosition(address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, int256 notional, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
| direction  | enum LibPerpetual.Side | undefined |
| notional  | int256 | undefined |
| amount  | int256 | undefined |

### FundingPayment

```solidity
event FundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| blockNumber `indexed` | uint256 | undefined |
| value  | uint256 | undefined |
| isPositive  | bool | undefined |

### LiquidationCall

```solidity
event LiquidationCall(address indexed liquidatee, address indexed liquidator, uint128 timestamp, uint256 notional)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidatee `indexed` | address | undefined |
| liquidator `indexed` | address | undefined |
| timestamp  | uint128 | undefined |
| notional  | uint256 | undefined |

### LiquidityProvided

```solidity
event LiquidityProvided(address indexed liquidityProvider, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityProvider `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |

### LiquidityRemoved

```solidity
event LiquidityRemoved(address indexed liquidityProvider, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityProvider `indexed` | address | undefined |
| amount  | uint256 | undefined |

### LiquidityWithdrawn

```solidity
event LiquidityWithdrawn(address indexed liquidityProvider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityProvider `indexed` | address | undefined |

### Log

```solidity
event Log(string errorMessage)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| errorMessage  | string | undefined |

### OpenPosition

```solidity
event OpenPosition(address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, int256 notional, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
| direction  | enum LibPerpetual.Side | undefined |
| notional  | int256 | undefined |
| amount  | int256 | undefined |

### Paused

```solidity
event Paused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

### Settlement

```solidity
event Settlement(address indexed user, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| amount  | int256 | undefined |

### TransferOwner

```solidity
event TransferOwner(address indexed sender, address indexed recipient)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender `indexed` | address | undefined |
| recipient `indexed` | address | undefined |

### TransferOwnerClaim

```solidity
event TransferOwnerClaim(address indexed sender, address indexed recipient)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender `indexed` | address | undefined |
| recipient `indexed` | address | undefined |

### Unpaused

```solidity
event Unpaused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |



## Errors

### PRBMathSD59x18__AbsInputTooSmall

```solidity
error PRBMathSD59x18__AbsInputTooSmall()
```

Emitted when the input is MIN_SD59x18.




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


