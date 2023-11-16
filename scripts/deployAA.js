// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const {
  encodeDeployData,
  encodeFunctionData,
  getContractAddress,
  toBytes,
  toHex,
} = require("viem");
const { baseGoerli } = require("viem/chains");
const {
  LocalAccountSigner,
  getDefaultEntryPointAddress,
} = require("@alchemy/aa-core");
const {
  AlchemyProvider,
  withAlchemyGasFeeEstimator,
} = require("@alchemy/aa-alchemy");
const {
  LightSmartContractAccount,
  getDefaultLightAccountFactoryAddress,
} = require("@alchemy/aa-accounts");

const {
  abi,
  bytecode,
} = require("../artifacts/contracts/Storage.sol/Storage.json");

const rpcUrl = process.env.BASE_GOERLI_ALCHEMY_API_URL;
const deployProxyAddr = process.env.DEPLOY_PROXY_ADDRESS;
const chain = baseGoerli;

async function main() {
  const publicClient = await hre.viem.getPublicClient();

  const localSigner = LocalAccountSigner.mnemonicToAccountSigner(
    process.env.MNEMONIC
  );

  const baseSigner = new AlchemyProvider({
    rpcUrl,
    chain,
    opts: {
      txMaxRetries: 60,
    },
  }).connect((provider) => {
    return new LightSmartContractAccount({
      chain,
      owner: localSigner,
      entryPointAddress: getDefaultEntryPointAddress(chain),
      factoryAddress: getDefaultLightAccountFactoryAddress(chain),
      rpcClient: provider,
    });
  });

  const smartAccountAddress = await baseSigner.getAddress();

  const dummyPaymasterDataMiddleware = async (uoStruct) => {
    // Return an object like {paymasterAndData: "0x..."} where "0x..." is the valid paymasterAndData for your paymaster contract (used in gas estimation)
    // You can even hardcode these dummy singatures
    // You can read up more on dummy signatures here: https://www.alchemy.com/blog/dummy-signatures-and-gas-token-transfers
    console.log("dummy paymaster for gas estimate", uoStruct);
    const params1 = await resolveProperties(uoStruct);
    console.log("params1", params1);

    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_paymasterAndDataForUserOperation",
      params: [
        {
          ...params1,
          nonce: toHex(Number(params1.nonce)),
          sender: smartAccountAddress,
          callGasLimit: "0x0",
          preVerificationGas: "0x0",
          verificationGasLimit: "0x0",
          maxFeePerGas: "0x0",
          maxPriorityFeePerGas: "0x0",
        },
        baseSigner.getEntryPointAddress(),
        toHex(chain.id),
      ],
    };

    const response = await fetch("https://paymaster.base.org", {
      method: "post",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();

    console.log("response", data);

    return {
      paymasterAndData: data.result,
    };
  };

  // Define the PaymasterDataMiddlewareOverrideFunction
  const paymasterDataMiddleware = async (uoStruct) => {
    // Return at minimum {paymasterAndData: "0x..."}, can also return gas estimates
    console.log("final paymaster", uoStruct);

    const params1 = await resolveProperties(uoStruct);
    console.log("params1", params1);
    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_paymasterAndDataForUserOperation",
      params: [
        {
          ...params1,
          nonce: toHex(Number(params1.nonce)),
          sender: smartAccountAddress,
          callGasLimit: toHex(Number(params1.callGasLimit)),
          preVerificationGas: toHex(Number(params1.preVerificationGas)),
          verificationGasLimit: toHex(Number(params1.verificationGasLimit)),
          maxFeePerGas: toHex(Number(params1.maxFeePerGas)),
          maxPriorityFeePerGas: toHex(Number(params1.maxPriorityFeePerGas)),
        },
        baseSigner.getEntryPointAddress(),
        toHex(chain.id),
      ],
    };

    const response = await fetch("https://paymaster.base.org", {
      method: "post",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();

    console.log("response", data);

    return {
      paymasterAndData: data.result,
    };
  };

  const signer = withAlchemyGasFeeEstimator(baseSigner, 50n, 50n);

  // Integrate the dummy paymaster data middleware and paymaster data middleware middleware with the provider
  const smartAccountSigner = signer.withPaymasterMiddleware({
    dummyPaymasterDataMiddleware,
    paymasterDataMiddleware,
  });

  const conData = encodeDeployData({
    abi,
    bytecode,
  });

  const nonce = await smartAccountSigner.account.getNonce();
  const zeros =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const nonceLength = String(nonce).length;
  const salt = zeros.slice(0, zeros.length - nonceLength) + String(nonce);
  console.log("salt", salt);

  const mintDeployTxnHash = await smartAccountSigner.sendTransaction({
    from: await baseSigner.getAddress(),
    to: deployProxyAddr,
    data: salt + conData.slice(2),
  });
  const newAddress = getContractAddress({
    bytecode: conData,
    from: deployProxyAddr,
    opcode: "CREATE2",
    salt: toBytes(salt),
  });

  console.log("deployed", mintDeployTxnHash, newAddress);

  const storageWriteTxnHash = await smartAccountSigner.sendTransaction({
    from: smartAccountAddress,
    to: newAddress,
    data: encodeFunctionData({
      abi,
      functionName: "store",
      args: [123],
    }),
  });

  await publicClient.waitForTransactionReceipt({ hash: storageWriteTxnHash });

  const storageReadResult = await publicClient.readContract({
    address: newAddress,
    abi,
    functionName: "retrieve",
  });
  console.log("new storage value", storageReadResult);

  /*

  const storage = getContract({
    address: newAddress,
    abi,
    publicClient,
  });

  const hash = await storage.write.store([222n]);

  await publicClient.waitForTransactionReceipt({ hash });

  const storedValue = await storage.read.retrieve();
  console.log(`New read: ${storedValue}`);

  const updateCountValue = await storage.read.updateCount();
  console.log(`New updateCount: ${updateCountValue}`);
  */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function resolveProperties(object) {
  const promises = Object.keys(object).map((key) => {
    const value = object[key];
    return Promise.resolve(value).then((v) => ({ key: key, value: v }));
  });

  const results = await Promise.all(promises);

  return results.reduce((accum, curr) => {
    accum[curr.key] = curr.value;
    return accum;
  }, {});
}
