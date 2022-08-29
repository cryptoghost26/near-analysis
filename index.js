const nearAPI = require("near-api-js");
const axios = require("axios");
const dotenv = require("dotenv");
const BigNumber = require('bignumber.js');
const { Parser } = require('json2csv');
const fs = require('fs');
dotenv.config();

const { keyStores, KeyPair, connect } = nearAPI;
const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = process.env.PRIVATE_KEY;
// creates a public / private key pair using the provided private key
const keyPair = KeyPair.fromString(PRIVATE_KEY);
const EPOCHS_A_YEAR = 730;
const REWARD_PCT_PER_YEAR = 0.05;
const PROTOCOL_REWARD_RATE = 0.1;
const STARTBLOCK1 = 45762662; 
const LASTBLOCKNUMBER = 72589889;
const json2csvParser = new Parser();
const initialize = async (account) => {
  try {
      // adds the keyPair you created to keyStore
      await myKeyStore.setKey("mainnet", account, keyPair);
      
      const connectionConfig = {
          networkId: "mainnet",
          keyStore: myKeyStore,
          nodeUrl: "https://archival-rpc.mainnet.near.org",
          walletUrl: "https://wallet.near.org",
          explorerUrl: "https://explorer.near.org",
      }
      
      const nearConnection = await connect(connectionConfig);
      return nearConnection;
  } catch(e){
      console.log("initialize error:", e);
  }
}


const calculateStartBlock = async(near, blockNumber) => {       
    const validatorRes1 = await near.connection.provider.validators(72589889);   
    const epoch = validatorRes1.epoch_height;
    console.log("Validator Start Epoch  : ", epoch);
    return {
        epochLastBlock : 60623481 + 43200 -1,
        epoch : epoch
    };
}


const fetchEpochBlockInfo = async (near, startBlock) => {
    const protocolRes = await near.connection.provider.experimental_protocolConfig({ block_id: startBlock });
    const numBlocksPerYear = protocolRes.num_blocks_per_year;
    const epochLength = protocolRes.epoch_length;
    const maxInflationRate = (protocolRes.max_inflation_rate[0] / protocolRes.max_inflation_rate[1]) === 0 ? 0.05 : (protocolRes.max_inflation_rate[0] / protocolRes.max_inflation_rate[1]).toFixed(2);
    const epochBlock = await near.connection.provider.block({blockId:startBlock});
    const epochBlockHeight = epochBlock.header.height;
    const totalSupplyAtEpoch = new BigNumber(epochBlock.header.total_supply);
    return {
        numBlocksPerYear,
        epochLength,
        maxInflationRate,
        totalSupplyAtEpoch,
        epochBlockHeight
    }
    
}

const checkValidatorStatus = async (near, startBlock) => {
    const table = [];
    let blockNumber;
    blockNumber = startBlock;
    while (blockNumber >= STARTBLOCK1){
        try {
            console.log("blockNumber : ", blockNumber);
            const validatorRes = await near.connection.provider.validators(blockNumber);
            const currentValidators = validatorRes.current_validators;

            const validatorInfo = currentValidators.map(validator => {
                return {
                    epoch : validatorRes.epoch_height,
                    blockHeight: validatorRes.epoch_start_height,
                    account : validator.account_id,
                    stake : (validator.stake / (10**24)).toFixed(2),
                }
            })
            table.push(...validatorInfo);
            blockNumber = validatorRes.epoch_start_height - 1;
        }
        catch(e){
            console.log("Fetch Block Error : ", e);
            console.log("-------\n");
            blockNumber-=1;
           
        }
    }
    return {table, blockNumber};
  }


start = async (ready) => {
    let accountId = `${process.env.ACCOUNT}.near`
    console.log("1. initialize ===");
    const near = await initialize(accountId);
    if (ready){
        try {
        let {epochLastBlock, ...rest} = await calculateStartBlock(near, LASTBLOCKNUMBER);
        let {table, blockNumber} = await checkValidatorStatus(near, epochLastBlock);
        const csv = json2csvParser.parse(table);
        fs.writeFileSync(`nearValidator_${blockNumber}.csv`, csv);
        process.exit();
        }
        catch(e){
          console.log("Error: ", e);
        }
    }
    else{
        let {epochLastBlock, ...rest} = await testBlock(near, 65505087);
    }
  };

start(true);