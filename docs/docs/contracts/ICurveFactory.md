# ICurveFactory









## Methods

### accept_transfer_ownership

```solidity
function accept_transfer_ownership() external nonpayable
```






### add_base_pool

```solidity
function add_base_pool(address _base_pool, address _metapool_implementation, address _fee_receiver) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _base_pool | address | undefined
| _metapool_implementation | address | undefined
| _fee_receiver | address | undefined

### commit_transfer_ownership

```solidity
function commit_transfer_ownership(address addr) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| addr | address | undefined

### convert_fees

```solidity
function convert_fees() external nonpayable returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### deploy_metapool

```solidity
function deploy_metapool(address _base_pool, string[32] _name, string[10] _symbol, address _coin, uint256 _A, uint256 _fee) external nonpayable returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _base_pool | address | undefined
| _name | string[32] | undefined
| _symbol | string[10] | undefined
| _coin | address | undefined
| _A | uint256 | undefined
| _fee | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### deploy_plain_pool

```solidity
function deploy_plain_pool(string[32] _name, string[10] _symbol, address[2] _coins, uint256 _A, uint256 _fee, uint256 _asset_type, uint256 _implementation_idx) external nonpayable returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _name | string[32] | undefined
| _symbol | string[10] | undefined
| _coins | address[2] | undefined
| _A | uint256 | undefined
| _fee | uint256 | undefined
| _asset_type | uint256 | undefined
| _implementation_idx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### find_pool_for_coins

```solidity
function find_pool_for_coins(address _from, address _to, uint256 i) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _from | address | undefined
| _to | address | undefined
| i | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### get_A

```solidity
function get_A(address _pool) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### get_admin_balances

```solidity
function get_admin_balances(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### get_balances

```solidity
function get_balances(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### get_coin_indices

```solidity
function get_coin_indices(address _pool, address _from, address _to) external view returns (int128, int128, bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined
| _from | address | undefined
| _to | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int128 | undefined
| _1 | int128 | undefined
| _2 | bool | undefined

### get_coins

```solidity
function get_coins(address _pool) external view returns (address[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[2] | undefined

### get_decimals

```solidity
function get_decimals(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### get_fees

```solidity
function get_fees(address _pool) external view returns (uint256, uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint256 | undefined

### get_n_coins

```solidity
function get_n_coins(address _pool) external view returns (uint256, uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint256 | undefined

### get_rates

```solidity
function get_rates(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### get_underlying_balances

```solidity
function get_underlying_balances(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### get_underlying_coins

```solidity
function get_underlying_coins(address _pool) external view returns (address[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[2] | undefined

### get_underlying_decimals

```solidity
function get_underlying_decimals(address _pool) external view returns (uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _pool | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined

### set_fee_receiver

```solidity
function set_fee_receiver(address _base_pool, address _fee_receiver) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _base_pool | address | undefined
| _fee_receiver | address | undefined




