# MockStableSwap





Mock StableSwap market to test buying/selling of derivative toknens

*Uses the well-known x * y = k formula*

## Methods

### burnVBase

```solidity
function burnVBase(uint256 amount) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### burnVQuote

```solidity
function burnVQuote(uint256 amount) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### mintVBase

```solidity
function mintVBase(uint256 amount) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### mintVQuote

```solidity
function mintVQuote(uint256 amount) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### pool

```solidity
function pool() external view returns (uint256 vQuote, uint256 vBase, uint256 totalAssetReserve, uint256 price)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| vQuote | uint256 | undefined
| vBase | uint256 | undefined
| totalAssetReserve | uint256 | undefined
| price | uint256 | undefined

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined



## Events

### NewReserves

```solidity
event NewReserves(uint256 vBase, uint256 vQuote, uint256 newPrice, uint256 blockNumber)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vBase  | uint256 | undefined |
| vQuote  | uint256 | undefined |
| newPrice  | uint256 | undefined |
| blockNumber  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |



