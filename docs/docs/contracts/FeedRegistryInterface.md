# FeedRegistryInterface









## Methods

### confirmFeed

```solidity
function confirmFeed(address base, address quote, address aggregator) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| aggregator | address | undefined

### decimals

```solidity
function decimals(address base, address quote) external view returns (uint8)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### description

```solidity
function description(address base, address quote) external view returns (string)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### getAnswer

```solidity
function getAnswer(address base, address quote, uint256 roundId) external view returns (int256 answer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| answer | int256 | undefined

### getCurrentPhaseId

```solidity
function getCurrentPhaseId(address base, address quote) external view returns (uint16 currentPhaseId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| currentPhaseId | uint16 | undefined

### getFeed

```solidity
function getFeed(address base, address quote) external view returns (contract AggregatorV2V3Interface aggregator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| aggregator | contract AggregatorV2V3Interface | undefined

### getNextRoundId

```solidity
function getNextRoundId(address base, address quote, uint80 roundId) external view returns (uint80 nextRoundId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint80 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| nextRoundId | uint80 | undefined

### getPhase

```solidity
function getPhase(address base, address quote, uint16 phaseId) external view returns (struct FeedRegistryInterface.Phase phase)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| phaseId | uint16 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| phase | FeedRegistryInterface.Phase | undefined

### getPhaseFeed

```solidity
function getPhaseFeed(address base, address quote, uint16 phaseId) external view returns (contract AggregatorV2V3Interface aggregator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| phaseId | uint16 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| aggregator | contract AggregatorV2V3Interface | undefined

### getPhaseRange

```solidity
function getPhaseRange(address base, address quote, uint16 phaseId) external view returns (uint80 startingRoundId, uint80 endingRoundId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| phaseId | uint16 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| startingRoundId | uint80 | undefined
| endingRoundId | uint80 | undefined

### getPreviousRoundId

```solidity
function getPreviousRoundId(address base, address quote, uint80 roundId) external view returns (uint80 previousRoundId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint80 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| previousRoundId | uint80 | undefined

### getProposedFeed

```solidity
function getProposedFeed(address base, address quote) external view returns (contract AggregatorV2V3Interface proposedAggregator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| proposedAggregator | contract AggregatorV2V3Interface | undefined

### getRoundData

```solidity
function getRoundData(address base, address quote, uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| _roundId | uint80 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| roundId | uint80 | undefined
| answer | int256 | undefined
| startedAt | uint256 | undefined
| updatedAt | uint256 | undefined
| answeredInRound | uint80 | undefined

### getRoundFeed

```solidity
function getRoundFeed(address base, address quote, uint80 roundId) external view returns (contract AggregatorV2V3Interface aggregator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint80 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| aggregator | contract AggregatorV2V3Interface | undefined

### getTimestamp

```solidity
function getTimestamp(address base, address quote, uint256 roundId) external view returns (uint256 timestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| timestamp | uint256 | undefined

### isFeedEnabled

```solidity
function isFeedEnabled(address aggregator) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| aggregator | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### latestAnswer

```solidity
function latestAnswer(address base, address quote) external view returns (int256 answer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| answer | int256 | undefined

### latestRound

```solidity
function latestRound(address base, address quote) external view returns (uint256 roundId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| roundId | uint256 | undefined

### latestRoundData

```solidity
function latestRoundData(address base, address quote) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| roundId | uint80 | undefined
| answer | int256 | undefined
| startedAt | uint256 | undefined
| updatedAt | uint256 | undefined
| answeredInRound | uint80 | undefined

### latestTimestamp

```solidity
function latestTimestamp(address base, address quote) external view returns (uint256 timestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| timestamp | uint256 | undefined

### proposeFeed

```solidity
function proposeFeed(address base, address quote, address aggregator) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| aggregator | address | undefined

### proposedGetRoundData

```solidity
function proposedGetRoundData(address base, address quote, uint80 roundId) external view returns (uint80 id, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined
| roundId | uint80 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| id | uint80 | undefined
| answer | int256 | undefined
| startedAt | uint256 | undefined
| updatedAt | uint256 | undefined
| answeredInRound | uint80 | undefined

### proposedLatestRoundData

```solidity
function proposedLatestRoundData(address base, address quote) external view returns (uint80 id, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| id | uint80 | undefined
| answer | int256 | undefined
| startedAt | uint256 | undefined
| updatedAt | uint256 | undefined
| answeredInRound | uint80 | undefined

### version

```solidity
function version(address base, address quote) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| base | address | undefined
| quote | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined



## Events

### FeedConfirmed

```solidity
event FeedConfirmed(address indexed asset, address indexed denomination, address indexed latestAggregator, address previousAggregator, uint16 nextPhaseId, address sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| asset `indexed` | address | undefined |
| denomination `indexed` | address | undefined |
| latestAggregator `indexed` | address | undefined |
| previousAggregator  | address | undefined |
| nextPhaseId  | uint16 | undefined |
| sender  | address | undefined |

### FeedProposed

```solidity
event FeedProposed(address indexed asset, address indexed denomination, address indexed proposedAggregator, address currentAggregator, address sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| asset `indexed` | address | undefined |
| denomination `indexed` | address | undefined |
| proposedAggregator `indexed` | address | undefined |
| currentAggregator  | address | undefined |
| sender  | address | undefined |



