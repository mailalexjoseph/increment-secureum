solc-select use 0.8.4
slither . --filter-paths "node_modules|ICurveFactory|ICryptoSwap|ICurveToken|CurveCryptoSwap2ETH|ICurveCryptoFactory|test|mocks" --exclude reentrancy-no-eth,reentrancy-events,reentrancy-benign
