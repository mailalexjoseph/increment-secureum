# IPerpetual









## Methods

### closePosition

```solidity
function closePosition() external nonpayable
```






### deposit

```solidity
function deposit(uint256 amount, contract IERC20 token) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined

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

### openPosition

```solidity
function openPosition(uint256 amount, enum LibPerpetual.Side direction) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| direction | enum LibPerpetual.Side | undefined

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

### provideLiquidity

```solidity
function provideLiquidity(uint256 amount, contract IERC20 token) external nonpayable returns (uint256, uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint256 | undefined

### setPrice

```solidity
function setPrice(LibPerpetual.Price newPrice) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newPrice | LibPerpetual.Price | undefined

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





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined

### withdrawLiquidity

```solidity
function withdrawLiquidity(uint256 amount, contract IERC20 token) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined
| token | contract IERC20 | undefined



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



