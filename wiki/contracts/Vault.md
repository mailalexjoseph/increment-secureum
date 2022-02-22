# Vault







*Vault must be called right after Perpetual is deployed to set Perpetual as the owner of the contract*

## Methods

### chainlinkOracle

```solidity
function chainlinkOracle() external view returns (contract IChainlinkOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IChainlinkOracle | undefined

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

### deposit

```solidity
function deposit(uint256 idx, address user, uint256 amount, contract IERC20 depositToken) external nonpayable returns (uint256)
```

Deposit reserveTokens to account



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| user | address | undefined
| amount | uint256 | Amount of reserveTokens with token decimals
| depositToken | contract IERC20 | Token address deposited (used for backwards compatibility)

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getAssetPrice

```solidity
function getAssetPrice() external pure returns (int256)
```

get the price of an asset




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getBadDebt

```solidity
function getBadDebt() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getBalance

```solidity
function getBalance(uint256 idx, address user) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| user | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getReserveTokenDecimals

```solidity
function getReserveTokenDecimals() external view returns (uint256)
```

get the number of decimals of the ERC20 token used in the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getReserveValue

```solidity
function getReserveValue(uint256 idx, address account) external view returns (int256)
```

get the Portfolio value of an account



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| account | address | Account address

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getTotalReserveToken

```solidity
function getTotalReserveToken() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### insurance

```solidity
function insurance() external view returns (contract IInsurance)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IInsurance | undefined

### owner

```solidity
function owner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### pendingOwner

```solidity
function pendingOwner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### reserveToken

```solidity
function reserveToken() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### setClearingHouse

```solidity
function setClearingHouse(contract IClearingHouse newClearingHouse) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newClearingHouse | contract IClearingHouse | undefined

### settleProfit

```solidity
function settleProfit(uint256 idx, address user, int256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| user | address | undefined
| amount | int256 | undefined

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

### withdraw

```solidity
function withdraw(uint256 idx, address user, uint256 amount, contract IERC20 withdrawToken) external nonpayable returns (uint256)
```

Withdraw ERC20 reserveToken from margin of the contract account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| user | address | undefined
| amount | uint256 | Amount of USDC deposited
| withdrawToken | contract IERC20 | ERC20 reserveToken address

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### withdrawAll

```solidity
function withdrawAll(uint256 idx, address user, contract IERC20 withdrawToken) external nonpayable returns (uint256)
```

Withdraw all ERC20 reserveToken from margin of the contract account.



#### Parameters

| Name | Type | Description |
|---|---|---|
| idx | uint256 | undefined
| user | address | undefined
| withdrawToken | contract IERC20 | ERC20 reserveToken address

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined



## Events

### BadDebtGenerated

```solidity
event BadDebtGenerated(uint256 idx, address beneficiary, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| idx  | uint256 | undefined |
| beneficiary  | address | undefined |
| amount  | uint256 | undefined |

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


