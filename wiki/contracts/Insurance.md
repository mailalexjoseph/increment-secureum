# Insurance









## Methods

### claimOwner

```solidity
function claimOwner() external nonpayable
```

`pendingOwner` can claim `owner` account.




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

### setVault

```solidity
function setVault(contract IVault vault_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault_ | contract IVault | undefined

### settleDebt

```solidity
function settleDebt(uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

### token

```solidity
function token() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

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

### withdrawRemainder

```solidity
function withdrawRemainder() external nonpayable
```








## Events

### DebtSettled

```solidity
event DebtSettled(address indexed user, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| amount  | uint256 | undefined |

### LiquidityWithdrawn

```solidity
event LiquidityWithdrawn(uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
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

### VaultChanged

```solidity
event VaultChanged(contract IVault vault)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault  | contract IVault | undefined |



