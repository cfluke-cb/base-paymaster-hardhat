require("dotenv").config(); //all the key value pairs are being made available due to this lib
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");

const mnemonic = process.env.MNEMONIC;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks: {
    base: {
      url: `${process.env.BASE_ALCHEMY_API_URL}`,
      accounts: {
        mnemonic,
      },
    },
    baseGoerli: {
      url: `${process.env.BASE_GOERLI_ALCHEMY_API_URL}`,
      accounts: {
        mnemonic,
      },
    },
  },
};
