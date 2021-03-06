/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { Factory, FactoryInterface } from "../Factory";

const _abi = [
  {
    name: "CryptoPoolDeployed",
    inputs: [
      {
        name: "token",
        type: "address",
        indexed: false,
      },
      {
        name: "coins",
        type: "address[2]",
        indexed: false,
      },
      {
        name: "A",
        type: "uint256",
        indexed: false,
      },
      {
        name: "gamma",
        type: "uint256",
        indexed: false,
      },
      {
        name: "mid_fee",
        type: "uint256",
        indexed: false,
      },
      {
        name: "out_fee",
        type: "uint256",
        indexed: false,
      },
      {
        name: "allowed_extra_profit",
        type: "uint256",
        indexed: false,
      },
      {
        name: "fee_gamma",
        type: "uint256",
        indexed: false,
      },
      {
        name: "adjustment_step",
        type: "uint256",
        indexed: false,
      },
      {
        name: "admin_fee",
        type: "uint256",
        indexed: false,
      },
      {
        name: "ma_half_time",
        type: "uint256",
        indexed: false,
      },
      {
        name: "initial_price",
        type: "uint256",
        indexed: false,
      },
      {
        name: "deployer",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "LiquidityGaugeDeployed",
    inputs: [
      {
        name: "pool",
        type: "address",
        indexed: false,
      },
      {
        name: "token",
        type: "address",
        indexed: false,
      },
      {
        name: "gauge",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "UpdateFeeReceiver",
    inputs: [
      {
        name: "_old_fee_receiver",
        type: "address",
        indexed: false,
      },
      {
        name: "_new_fee_receiver",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "UpdatePoolImplementation",
    inputs: [
      {
        name: "_old_pool_implementation",
        type: "address",
        indexed: false,
      },
      {
        name: "_new_pool_implementation",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "UpdateTokenImplementation",
    inputs: [
      {
        name: "_old_token_implementation",
        type: "address",
        indexed: false,
      },
      {
        name: "_new_token_implementation",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "UpdateGaugeImplementation",
    inputs: [
      {
        name: "_old_gauge_implementation",
        type: "address",
        indexed: false,
      },
      {
        name: "_new_gauge_implementation",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    name: "TransferOwnership",
    inputs: [
      {
        name: "_old_owner",
        type: "address",
        indexed: false,
      },
      {
        name: "_new_owner",
        type: "address",
        indexed: false,
      },
    ],
    anonymous: false,
    type: "event",
  },
  {
    stateMutability: "nonpayable",
    type: "constructor",
    inputs: [
      {
        name: "_fee_receiver",
        type: "address",
      },
      {
        name: "_pool_implementation",
        type: "address",
      },
      {
        name: "_token_implementation",
        type: "address",
      },
      {
        name: "_gauge_implementation",
        type: "address",
      },
      {
        name: "_weth",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "deploy_pool",
    inputs: [
      {
        name: "_name",
        type: "string",
      },
      {
        name: "_symbol",
        type: "string",
      },
      {
        name: "_coins",
        type: "address[2]",
      },
      {
        name: "A",
        type: "uint256",
      },
      {
        name: "gamma",
        type: "uint256",
      },
      {
        name: "mid_fee",
        type: "uint256",
      },
      {
        name: "out_fee",
        type: "uint256",
      },
      {
        name: "allowed_extra_profit",
        type: "uint256",
      },
      {
        name: "fee_gamma",
        type: "uint256",
      },
      {
        name: "adjustment_step",
        type: "uint256",
      },
      {
        name: "admin_fee",
        type: "uint256",
      },
      {
        name: "ma_half_time",
        type: "uint256",
      },
      {
        name: "initial_price",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "deploy_gauge",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "set_fee_receiver",
    inputs: [
      {
        name: "_fee_receiver",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "set_pool_implementation",
    inputs: [
      {
        name: "_pool_implementation",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "set_token_implementation",
    inputs: [
      {
        name: "_token_implementation",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "set_gauge_implementation",
    inputs: [
      {
        name: "_gauge_implementation",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "commit_transfer_ownership",
    inputs: [
      {
        name: "_addr",
        type: "address",
      },
    ],
    outputs: [],
  },
  {
    stateMutability: "nonpayable",
    type: "function",
    name: "accept_transfer_ownership",
    inputs: [],
    outputs: [],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "find_pool_for_coins",
    inputs: [
      {
        name: "_from",
        type: "address",
      },
      {
        name: "_to",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "find_pool_for_coins",
    inputs: [
      {
        name: "_from",
        type: "address",
      },
      {
        name: "_to",
        type: "address",
      },
      {
        name: "i",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_coins",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address[2]",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_decimals",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[2]",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_balances",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[2]",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_coin_indices",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
      {
        name: "_from",
        type: "address",
      },
      {
        name: "_to",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_gauge",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_eth_index",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "get_token",
    inputs: [
      {
        name: "_pool",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "admin",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "future_admin",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "fee_receiver",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "pool_implementation",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "token_implementation",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "gauge_implementation",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "pool_count",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    stateMutability: "view",
    type: "function",
    name: "pool_list",
    inputs: [
      {
        name: "arg0",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
      },
    ],
  },
];

const _bytecode =
  "0x602061130e6080396080518060a01c6113095760e0526020602061130e016080396080518060a01c61130957610100526020604061130e016080396080518060a01c61130957610120526020606061130e016080396080518060a01c61130957610140526020608061130e016080396080518060a01c611309576101605260e0516002556101005160035561012051600455610140516005553360005561016051610180527f2861448678f0be67f11bfb5481b3e3b4cfeb3acc6126ad60a05f95bfc653066660006101a05260e0516101c05260406101a0a17f0617fd31aa5ab95ec80eefc1eb61a2c477aa419d1d761b4e46f5f077e47852aa60006101a052610100516101c05260406101a0a17f1cc4f8e20b0cd3e5109eb156cadcfd3a5496ac0794c6085ca02afd7d710dd56660006101a052610120516101c05260406101a0a17f1fd705f9c77053962a503f2f2f57f0862b4c3af687c25615c13817a86946c35960006101a052610140516101c05260406101a0a17f5c486528ec3e3f0ea91181cff8116f02bfa350e03b8b6f12e00765adbb5af85c60006101a052336101c05260406101a0a16112e156600436101561000d57611128565b60046000601c376000513461112e5763c955fa04811861080057600435600401602081351161112e57808035602001808260e037505050602435600401600a81351161112e578080356020018082610120375050506044358060a01c61112e57610160526064358060a01c61112e5761018052610f9f608435111561112e5763ee6b2801608435101561112e576402540be3ff60a435111561112e5766470de4df82000160a435101561112e576207a11f60c435111561112e576402540be3ff60c435101561112e5760c43560e4351061112e576402540be3ff60e435101561112e57670de0b6b3a764000161016435101561112e57662386f26fc1000161010435101561112e57670de0b6b3a764000161012435101561112e57600061012435111561112e57670de0b6b3a764000161014435101561112e57600061014435111561112e5762093a8061018435101561112e57600061018435111561112e57620f42406101a435111561112e576c0c9f2c9cd04674edea400000006101a435101561112e576101805161016051141561021857600f6101a0527f4475706c696361746520636f696e7300000000000000000000000000000000006101c0526101a0506101a051806101c001818260206001820306601f82010390500336823750506308c379a0610160526020610180526101a05160206001820306601f820103905060440161017cfd5b6040366101a0376101e060006002818352015b63313ce567610220526020610220600461023c6101606101e051600281101561112e5760200201515afa610264573d600060003e3d6000fd5b601f3d111561112e576102205161020052601361020051106102f7576019610220527f4d617820313820646563696d616c7320666f7220636f696e73000000000000006102405261022050610220518061024001818260206001820306601f82010390500336823750506308c379a06101e0526020610200526102205160206001820306601f82010390506044016101fcfd5b610200516101a06101e051600281101561112e576020020152815160010180835281141561022b57505060126101a05180821061112e578082039050905060126101c05180821061112e578082039050905060081b818183011061112e57808201905090506101e0526000601e610260527f43757276652e666920466163746f72792043727970746f20506f6f6c3a20000061028052610260601e806020846102a00101826020850160045afa50508051820191505060e06020806020846102a00101826020850160045afa505080518201915050806102a0526102a09050805160200180610200828460045afa905050506000610120600a806020846102e00101826020850160045afa50508051820191505060026102a0527f2d660000000000000000000000000000000000000000000000000000000000006102c0526102a06002806020846102e00101826020850160045afa505080518201915050806102e0526102e09050805160200180610260828460045afa905050507f602d3d8160093d39f3363d3d373d3d3d363d73000000000000000000000000006102c05260045460601b6102d3527f5af43d82803e903d91602b57fd5bf300000000000000000000000000000000006102e75260366102c06000f06102a0527f602d3d8160093d39f3363d3d373d3d3d363d73000000000000000000000000006102e05260035460601b6102f3527f5af43d82803e903d91602b57fd5bf300000000000000000000000000000000006103075260366102e06000f06102c05263077f224a6102e0526103008060608082528083018061020080516020018083828460045afa905050508051806020830101818260206001820306601f8201039050033682375050805160200160206001820306601f820103905090509050810190506020820191508082528083018061026080516020018083828460045afa905050508051806020830101818260206001820306601f8201039050033682375050805160200160206001820306601f820103905090509050810190506020820191506102c05182525050506102a0513b1561112e57600060006101046102fc60006102a0515af161062a573d600060003e3d6000fd5b63a39e95c56102e0526101406084610300376102a05161044052610160516104605261018051610480526101e0516104a0526102c0513b1561112e57600060006101c46102fc60006102c0515af1610687573d600060003e3d6000fd5b6008546102e0526102c05160016102e05164010000000081101561112e5702600a01556102e0516001818183011061112e57808201905090506008556102a05160096102c05160a0526080526040608020556101a05160081b6101c051818183011061112e5780820190509050600460096102c05160a05260805260406080200155600260096102c05160a052608052604060802001610160518155610180516001820155506101805161016051186103005260076103005160a0526080526040608020546102e0526102c05160016102e05164010000000081101561112e570260066103005160a052608052604060802001556102e0516001818183011061112e578082019050905060076103005160a0526080526040608020557f0394cb40d7dbe28dad1d4ee890bdd35bbb0d89e17924a80a542535e83d54ba146102a0516103205261016051610340526101805161036052610140608461038037336104c0526101c0610320a16102c051610320526020610320f35b6396bebb348118610a4b576004358060a01c61112e5760e05260006002600960e05160a0526080526040608020015414156108a957600c610100527f556e6b6e6f776e20706f6f6c00000000000000000000000000000000000000006101205261010050610100518061012001818260206001820306601f82010390500336823750506308c379a060c052602060e0526101005160206001820306601f820103905060440160dcfd5b6001600960e05160a0526080526040608020015415610936576016610100527f476175676520616c7265616479206465706c6f796564000000000000000000006101205261010050610100518061012001818260206001820306601f82010390500336823750506308c379a060c052602060e0526101005160206001820306601f820103905060440160dcfd5b7f602d3d8160093d39f3363d3d373d3d3d363d73000000000000000000000000006101205260055460601b610133527f5af43d82803e903d91602b57fd5bf300000000000000000000000000000000006101475260366101206000f061010052600960e05160a0526080526040608020546101205263c4d66de8610140526101205161016052610100513b1561112e5760006000602461015c6000610100515af16109e6573d600060003e3d6000fd5b610100516001600960e05160a052608052604060802001557f1d6247eae69b5feb96b30be78552f35de45f61fdb6d6d7e1b08aae159b6226af60e05161014052610120516101605261010051610180526060610140a161010051610140526020610140f35b63e41ab7718118610aaa576004358060a01c61112e5760e052600054331861112e577f2861448678f0be67f11bfb5481b3e3b4cfeb3acc6126ad60a05f95bfc65306666002546101005260e051610120526040610100a160e051600255005b639ed796d08118610b09576004358060a01c61112e5760e052600054331861112e577f0617fd31aa5ab95ec80eefc1eb61a2c477aa419d1d761b4e46f5f077e47852aa6003546101005260e051610120526040610100a160e051600355005b63653023c28118610b68576004358060a01c61112e5760e052600054331861112e577f1cc4f8e20b0cd3e5109eb156cadcfd3a5496ac0794c6085ca02afd7d710dd5666004546101005260e051610120526040610100a160e051600455005b638f03182c8118610bc7576004358060a01c61112e5760e052600054331861112e577f1fd705f9c77053962a503f2f2f57f0862b4c3af687c25615c13817a86946c3596005546101005260e051610120526040610100a160e051600555005b636b441a408118610bf1576004358060a01c61112e5760e052600054331861112e5760e051600155005b63e5ea47b88118610c3c57600154331861112e577f5c486528ec3e3f0ea91181cff8116f02bfa350e03b8b6f12e00765adbb5af85c60005460e0523361010052604060e0a133600055005b63a87df06c8118610c5257600061012052610c65565b636982eb0b8118610cc057604435610120525b6004358060a01c61112e5760e0526024358060a01c61112e57610100526101005160e051186101405260016101205164010000000081101561112e570260066101405160a05260805260406080200154610160526020610160f35b639ac90d3d8118610d03576004358060a01c61112e5760e0526002600960e05160a052608052604060802001805461010052600181015461012052506040610100f35b6352b515558118610d58576004358060a01c61112e5760e0526004600960e05160a05260805260406080200154610100526101005160081c610120526101005161010080820690509050610140526040610120f35b6392e3cc2d8118610df4576004358060a01c61112e5760e052634903b0d1610100526000610120526020610100602461011c60e0515afa610d9e573d600060003e3d6000fd5b601f3d111561112e576101005161018052634903b0d1610140526001610160526020610140602461015c60e0515afa610ddc573d600060003e3d6000fd5b601f3d111561112e57610140516101a0526040610180f35b63eb85226d8118610f3f576004358060a01c61112e5760e0526024358060a01c61112e57610100526044358060a01c61112e57610120526002600960e05160a05260805260406080200180546101405260018101546101605250610140516101005118610e6957610160516101205114610e6c565b60005b610f2757610160516101005118610e8b57610140516101205114610e8e565b60005b610f0d57600f610180527f436f696e73206e6f7420666f756e6400000000000000000000000000000000006101a0526101805061018051806101a001818260206001820306601f82010390500336823750506308c379a0610140526020610160526101805160206001820306601f820103905060440161015cfd610f3d565b60016101805260006101a0526040610180610f3d56610f3d565b60006101805260016101a0526040610180610f3d565bf35b63daf297b98118610f77576004358060a01c61112e5760e0526001600960e05160a05260805260406080200154610100526020610100f35b63ccb156058118611025576004358060a01c61112e5760e05261010060006002818352015b602060203803608039608051600161010051600281101561112e57026002600960e05160a052608052604060802001015418610fe75750505061010051610120526020610120611023565b8151600101808352811415610f9c5750507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6101005260206101005bf35b63977d9122811861105a576004358060a01c61112e5760e052600960e05160a052608052604060802054610100526020610100f35b63f851a44081186110715760005460e052602060e0f35b6317f7182a81186110885760015460e052602060e0f35b63cab4d3db811861109f5760025460e052602060e0f35b632489a2c381186110b65760035460e052602060e0f35b6335214d8181186110cd5760045460e052602060e0f35b638df2420781186110e45760055460e052602060e0f35b63956aae3a81186110fb5760085460e052602060e0f35b633a1d5d8e811861112657600160043564010000000081101561112e5702600a015460e052602060e0f35b505b60006000fd5b600080fd5b6101ae6112e1036101ae6101a0396101ae6112e10361018051816101a00152806020016101a0f35b600080fd";

type FactoryConstructorParams =
  | [signer?: Signer]
  | ConstructorParameters<typeof ContractFactory>;

const isSuperArgs = (
  xs: FactoryConstructorParams
): xs is ConstructorParameters<typeof ContractFactory> => xs.length > 1;

export class Factory__factory extends ContractFactory {
  constructor(...args: FactoryConstructorParams) {
    if (isSuperArgs(args)) {
      super(...args);
    } else {
      super(_abi, _bytecode, args[0]);
    }
  }

  deploy(
    _fee_receiver: string,
    _pool_implementation: string,
    _token_implementation: string,
    _gauge_implementation: string,
    _weth: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<Factory> {
    return super.deploy(
      _fee_receiver,
      _pool_implementation,
      _token_implementation,
      _gauge_implementation,
      _weth,
      overrides || {}
    ) as Promise<Factory>;
  }
  getDeployTransaction(
    _fee_receiver: string,
    _pool_implementation: string,
    _token_implementation: string,
    _gauge_implementation: string,
    _weth: string,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(
      _fee_receiver,
      _pool_implementation,
      _token_implementation,
      _gauge_implementation,
      _weth,
      overrides || {}
    );
  }
  attach(address: string): Factory {
    return super.attach(address) as Factory;
  }
  connect(signer: Signer): Factory__factory {
    return super.connect(signer) as Factory__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): FactoryInterface {
    return new utils.Interface(_abi) as FactoryInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): Factory {
    return new Contract(address, _abi, signerOrProvider) as Factory;
  }
}
