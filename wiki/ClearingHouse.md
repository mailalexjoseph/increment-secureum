# ClearingHouse









## Methods

### FEE

```solidity
function FEE() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### INSURANCE_FEE

```solidity
function INSURANCE_FEE() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### LIQUIDATION_REWARD

```solidity
function LIQUIDATION_REWARD() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MIN_MARGIN

```solidity
function MIN_MARGIN() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### MIN_MARGIN_AT_CREATION

```solidity
function MIN_MARGIN_AT_CREATION() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### allowListPerpetual

```solidity
function allowListPerpetual(contract IPerpetual perp) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| perp | contract IPerpetual | undefined

### claimOwner

```solidity
function claimOwner() external nonpayable
```

`pendingOwner` can claim `owner` account.




### closePosition

```solidity
function closePosition(uint256 idx, uint256 tentativeVQuoteAmount) external nonpayable
```

Closes position from account holder



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| tentativeVQuoteAmount | uint256 | Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)

### deposit

```solidity
function deposit(uint256 idx, uint256 amount, contract IERC20 token) external nonpayable
```

Deposit tokens into the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | undefined
| token | contract IERC20 | undefined

### getFundingPayments

```solidity
function getFundingPayments(uint256 idx, address account) external view returns (int256 upcomingFundingPayment)
```

Calculate missed funding payments



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| upcomingFundingPayment | int256 | undefined

### getGlobalPosition

```solidity
function getGlobalPosition(uint256 idx) external view returns (struct LibPerpetual.GlobalPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.GlobalPosition | undefined

### getLpPosition

```solidity
function getLpPosition(uint256 idx, address account) external view returns (struct LibPerpetual.UserPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.UserPosition | undefined

### getReserveValue

```solidity
function getReserveValue(uint256 idx, address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getTraderPosition

```solidity
function getTraderPosition(uint256 idx, address account) external view returns (struct LibPerpetual.UserPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.UserPosition | undefined

### getUnrealizedPnL

```solidity
function getUnrealizedPnL(uint256 idx, address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### indexPrice

```solidity
function indexPrice(uint256 idx) external view returns (int256)
```

Return the current off-chain exchange rate for vBase/vQuote



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### insurance

```solidity
function insurance() external view returns (contract IInsurance)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IInsurance | undefined

### liquidate

```solidity
function liquidate(uint256 idx, address liquidatee, uint256 tentativeVQuoteAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| liquidatee | address | undefined
| tentativeVQuoteAmount | uint256 | Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)

### marginIsValid

```solidity
function marginIsValid(uint256 idx, address account, int256 ratio) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined
| ratio | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### marginRatio

```solidity
function marginRatio(uint256 idx, address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### marketPrice

```solidity
function marketPrice(uint256 idx) external view returns (uint256)
```

Return the last traded price (used for TWAP)



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### marketPriceOracle

```solidity
function marketPriceOracle(uint256 idx) external view returns (uint256)
```

Return the curve price oracle



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### numMarkets

```solidity
function numMarkets() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### openPosition

```solidity
function openPosition(uint256 idx, uint256 amount, enum LibPerpetual.Side direction) external nonpayable returns (int256, int256)
```

Open position, long or short

*No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATIONNo checks are done if bought amount exceeds allowance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | to be sold, in vQuote (if long) or vBase (if short)
| direction | enum LibPerpetual.Side | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined
| _1 | int256 | undefined

### openPositionWithUSDC

```solidity
function openPositionWithUSDC(uint256 idx, uint256 amount, enum LibPerpetual.Side direction) external nonpayable returns (int256, int256)
```

Function to be called by clients depositing USDC as collateral



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | undefined
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

### perpetuals

```solidity
function perpetuals(uint256) external view returns (contract IPerpetual)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPerpetual | undefined

### provideLiquidity

```solidity
function provideLiquidity(uint256 idx, uint256 amount, contract IERC20 token) external nonpayable returns (uint256, uint256)
```

Provide liquidity to the pool



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | of token to be added to the pool (with token decimals)
| token | contract IERC20 | to be added to the pool

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint256 | undefined

### removeLiquidity

```solidity
function removeLiquidity(uint256 idx, uint256 amount) external nonpayable
```

Remove liquidity from the pool (but don&#39;t close LP position and withdraw amount)



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | of liquidity to be removed from the pool (with 18 decimals)

### settleAndWithdrawLiquidity

```solidity
function settleAndWithdrawLiquidity(uint256 idx, uint256 tentativeVQuoteAmount) external nonpayable
```

Remove liquidity from the pool (but don&#39;t close LP position and withdraw amount)



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| tentativeVQuoteAmount | uint256 | at which to buy the LP position (if it looks like a short, more vQuote than vBase)

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

### vault

```solidity
function vault() external view returns (contract IVault)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVault | undefined

### withdraw

```solidity
function withdraw(uint256 idx, uint256 amount, contract IERC20 token) external nonpayable
```

Withdraw tokens from the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| amount | uint256 | undefined
| token | contract IERC20 | undefined



## Events

### ClosePosition

```solidity
event ClosePosition(uint256 idx, address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, int256 notional, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
| direction  | enum LibPerpetual.Side | undefined |
| notional  | int256 | undefined |
| amount  | int256 | undefined |

### Deposit

```solidity
event Deposit(uint256 idx, address indexed user, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| user `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |

### FundingPayment

```solidity
event FundingPayment(uint256 idx, uint256 indexed blockNumber, uint256 value, bool isPositive)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| blockNumber `indexed` | uint256 | undefined |
| value  | uint256 | undefined |
| isPositive  | bool | undefined |

### LiquidationCall

```solidity
event LiquidationCall(uint256 idx, address indexed liquidatee, address indexed liquidator, uint128 timestamp, uint256 notional)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| liquidatee `indexed` | address | undefined |
| liquidator `indexed` | address | undefined |
| timestamp  | uint128 | undefined |
| notional  | uint256 | undefined |

### LiquidityProvided

```solidity
event LiquidityProvided(uint256 idx, address indexed liquidityProvider, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| liquidityProvider `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |

### LiquidityRemoved

```solidity
event LiquidityRemoved(uint256 idx, address indexed liquidityProvider, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| liquidityProvider `indexed` | address | undefined |
| amount  | uint256 | undefined |

### LiquidityWithdrawn

```solidity
event LiquidityWithdrawn(uint256 idx, address indexed liquidityProvider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| liquidityProvider `indexed` | address | undefined |

### Log

```solidity
event Log(string errorMessage)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| errorMessage  | string | undefined |

### MarketAdded

```solidity
event MarketAdded(uint256 numPerpetuals, contract IPerpetual indexed perpetual)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| numPerpetuals  | uint256 | undefined |
| perpetual `indexed` | contract IPerpetual | undefined |

### OpenPosition

```solidity
event OpenPosition(uint256 idx, address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, int256 notional, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
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
event Settlement(uint256 idx, address indexed user, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
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

### Withdraw

```solidity
event Withdraw(uint256 idx, address indexed user, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| user `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |



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


