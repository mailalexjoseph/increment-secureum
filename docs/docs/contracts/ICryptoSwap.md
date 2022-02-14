# ICryptoSwap







*Contract https://github.com/curvefi/curve-crypto-contract/blob/master/deployment-logs/2021-11-01.%20EURS%20on%20mainnet/CryptoSwap.vy*

## Methods

### add_liquidity

```solidity
function add_liquidity(uint256[2] amounts, uint256 min_mint_amount) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amounts | uint256[2] | undefined
| min_mint_amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### balances

```solidity
function balances(uint256 i) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| i | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### exchange

```solidity
function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| i | uint256 | undefined
| j | uint256 | undefined
| dx | uint256 | undefined
| min_dy | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### get_dy

```solidity
function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| i | uint256 | undefined
| j | uint256 | undefined
| dx | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### get_virtual_price

```solidity
function get_virtual_price() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### price_oracle

```solidity
function price_oracle() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### remove_liquidity

```solidity
function remove_liquidity(uint256 _amount, uint256[2] min_amounts) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _amount | uint256 | undefined
| min_amounts | uint256[2] | undefined




