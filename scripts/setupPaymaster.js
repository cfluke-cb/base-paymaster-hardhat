const { toHex } = require("viem");
const { withAlchemyGasFeeEstimator } = require("@alchemy/aa-alchemy");

const paymasterUrl = "https://paymaster.base.org";

const setupPaymaster = (baseSigner, smartAccountAddress, chainId) => {
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
        toHex(chainId),
      ],
    };

    const response = await fetch(paymasterUrl, {
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
        toHex(chainId),
      ],
    };

    const response = await fetch(paymasterUrl, {
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
  return smartAccountSigner;
};

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

module.exports = {
  setupPaymaster,
};
