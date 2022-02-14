# IVault









## Methods

### deposit

```solidity
function deposit(address user, uint256 amount, contract IERC20 token) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| amount | uint256 | undefined
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getReserveTokenDecimals

```solidity
function getReserveTokenDecimals() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getReserveValue

```solidity
function getReserveValue(address account) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### oracle

```solidity
function oracle() external view returns (contract IOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IOracle | undefined

### reserveToken

```solidity
function reserveToken() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### settleProfit

```solidity
function settleProfit(address user, int256 amount) external nonpayable returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| amount | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### totalReserveToken

```solidity
function totalReserveToken() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### withdraw

```solidity
function withdraw(address user, uint256 amount, contract IERC20 token) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| amount | uint256 | undefined
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### withdrawAll

```solidity
function withdrawAll(address user, contract IERC20 withdrawToken) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| withdrawToken | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined




