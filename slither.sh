# solc-select use 0.8.4
# slither . --filter-paths "node_modules|ICurveFactory|ICryptoSwap|ICurveToken|CurveCryptoSwap2ETH|ICurveCryptoFactory|test|mocks" --exclude timestamp
solc-select use 0.8.4
slither . --filter-paths "node_modules|ICurveFactory|ICryptoSwap|ICurveToken|CurveCryptoSwap2ETH|ICurveCryptoFactory|test|mocks" --exclude timestamp,reentrancy-no-eth,reentrancy-events,reentrancy-benign
