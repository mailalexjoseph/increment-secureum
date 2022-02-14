# Oracle









## Methods

### _chainlinkPrice

```solidity
function _chainlinkPrice(contract AggregatorV3Interface chainlinkInterface) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| chainlinkInterface | contract AggregatorV3Interface | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### addAggregator

```solidity
function addAggregator(address _asset, address _aggregator) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _asset | address | undefined
| _aggregator | address | undefined

### claimOwner

```solidity
function claimOwner() external nonpayable
```

`pendingOwner` can claim `owner` account.




### getAssetPrice

```solidity
function getAssetPrice(address asset) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| asset | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getIndexPrice

```solidity
function getIndexPrice() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

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

### priceFeedKeys

```solidity
function priceFeedKeys(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### priceFeedMap

```solidity
function priceFeedMap(address) external view returns (contract AggregatorV3Interface)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract AggregatorV3Interface | undefined

### removeAggregator

```solidity
function removeAggregator(address _asset) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _asset | address | undefined

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



## Events

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



