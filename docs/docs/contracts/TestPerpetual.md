# TestPerpetual









## Methods

### FEE

```solidity
function FEE() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### LIQUIDATION_FEE

```solidity
function LIQUIDATION_FEE() external view returns (uint256)
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

### claimOwner

```solidity
function claimOwner() external nonpayable
```

`pendingOwner` can claim `owner` account.




### closePosition

```solidity
function closePosition() external nonpayable
```

Closes position from account holder




### deposit

```solidity
function deposit(uint256 amount, contract IERC20 token) external nonpayable
```

Deposits tokens into the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined

### getFundingPayments

```solidity
function getFundingPayments(LibPerpetual.TraderPosition user, LibPerpetual.GlobalPosition global) external pure returns (int256)
```

Calculate missed funding payments



#### Parameters

| Name | Type | Description |
|---|---|---|
| user | LibPerpetual.TraderPosition | undefined
| global | LibPerpetual.GlobalPosition | undefined

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

### getLatestPrice

```solidity
function getLatestPrice() external view returns (struct LibPerpetual.Price)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.Price | undefined

### getPrice

```solidity
function getPrice(uint256 period) external view returns (struct LibPerpetual.Price)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| period | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.Price | undefined

### getUserPosition

```solidity
function getUserPosition(address account) external view returns (struct LibPerpetual.TraderPosition)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LibPerpetual.TraderPosition | undefined

### indexPrice

```solidity
function indexPrice() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### liquidate

```solidity
function liquidate(address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

### liquidityPosition

```solidity
function liquidityPosition(address) external view returns (uint256 liquidityBalance, uint256 reserveBalance)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| liquidityBalance | uint256 | undefined
| reserveBalance | uint256 | undefined

### marginIsValid

```solidity
function marginIsValid(address account) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### marginRatio

```solidity
function marginRatio(address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

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






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### openPosition

```solidity
function openPosition(uint256 amount, enum LibPerpetual.Side direction) external nonpayable returns (uint256)
```

Open position, long or shortPrices are quoted in vQuote: https://www.delta.exchange/blog/support/what-is-an-inverse-futures-contract

*No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGINNo checks are done if bought amount exceeds allowance*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | Amount of virtual tokens to be bought
| direction | enum LibPerpetual.Side | Side of the position to open, long or short

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### oracle

```solidity
function oracle() external view returns (contract IOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IOracle | undefined

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

### provideLiquidity

```solidity
function provideLiquidity(uint256 amount, contract IERC20 token) external nonpayable returns (uint256, uint256)
```

Provide liquidity to the pool



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | of token to be added to the pool (with token decimals)
| token | contract IERC20 | to be added to the pool

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint256 | undefined

### realizedMarketPrice

```solidity
function realizedMarketPrice() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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

### setPrice

```solidity
function setPrice(LibPerpetual.Price newPrice) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newPrice | LibPerpetual.Price | undefined

### totalLiquidityProvided

```solidity
function totalLiquidityProvided() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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

Calculate the funding rate for the next block




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
function withdraw(uint256 amount, contract IERC20 token) external nonpayable
```

Withdraw tokens from the vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined

### withdrawLiquidity

```solidity
function withdrawLiquidity(uint256 amount, contract IERC20 token) external nonpayable
```

Withdraw liquidity from the pool



#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | of liquidity to be removed from the pool (with 18 decimals)
| token | contract IERC20 | to be removed from the pool



## Events

### ClosePosition

```solidity
event ClosePosition(address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, int256 notional, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
| direction  | enum LibPerpetual.Side | undefined |
| notional  | int256 | undefined |
| amount  | uint256 | undefined |

### Deposit

```solidity
event Deposit(address indexed user, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |

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

### LiquidityWithdrawn

```solidity
event LiquidityWithdrawn(address indexed liquidityProvider, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityProvider `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |

### OpenPosition

```solidity
event OpenPosition(address indexed user, uint128 indexed timeStamp, enum LibPerpetual.Side direction, uint256 notional, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
| direction  | enum LibPerpetual.Side | undefined |
| notional  | uint256 | undefined |
| amount  | uint256 | undefined |

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
event Settlement(address indexed user, uint128 indexed timeStamp, int256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| timeStamp `indexed` | uint128 | undefined |
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
event Withdraw(address indexed user, address indexed asset, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| asset `indexed` | address | undefined |
| amount  | uint256 | undefined |



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


