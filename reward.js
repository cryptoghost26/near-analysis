const nearAPI = require("near-api-js");
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
const STARTBLOCK1 = 45762662;   // 45770000 block : August 21, 2021 at 3:39:48pm
const LASTBLOCKNUMBER = 72589889;
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


const calculateStartEpoch = async(near, blockNumber) => {
        const validatorRes1 = await near.connection.provider.validators(blockNumber);
        const epoch = validatorRes1.epoch_height;
        console.log("Validator Start Epoch  : ", epoch);
        return {
            epochLastBlock : validatorRes1.epoch_start_height + 43200 -1,
            epoch : epoch
        };
    }


const fetchEpochBlockInfo = async (near, startBlock) => {
    const protocolRes = await near.connection.provider.experimental_protocolConfig({ block_id: startBlock });
    const numBlocksPerYear = protocolRes.num_blocks_per_year;
    const epochLength = protocolRes.epoch_length;
    const maxInflationRate = (protocolRes.max_inflation_rate[0] / protocolRes.max_inflation_rate[1]) === 0 ? 0.05 : (protocolRes.max_inflation_rate[0] / protocolRes.max_inflation_rate[1]).toFixed(2);
    const epochBlock = await near.connection.provider.block({blockId:startBlock}); 
    const epochBlockHeight = epochBlock.header.height; // epoch last block height
    const totalSupplyAtEpoch = new BigNumber(epochBlock.header.total_supply);
    return {
        numBlocksPerYear,
        epochLength,
        maxInflationRate,
        totalSupplyAtEpoch,
        epochBlockHeight
    }
    
}
const checkRewardStatus = async (near, block) => {
    let blockNumber;
    let {epochLastBlock, epoch} = await calculateStartEpoch(near, block);
    const table = [];
    blockNumber = epochLastBlock;
    //https://nomicon.io/Economics/Economic#contract-rewards
    // reward = totalSupply[t] * ((1 + REWARD_PCT_PER_YEAR) ** (1/EPOCHS_A_YEAR) - 1)
    // treasury_reward[t] = floor(reward[t] * protocol_reward_rate(0.1))    
    // validator_reward[t] = reward[t] - treasury_reward[t]
    
    while (blockNumber >= STARTBLOCK1){
        try {
            console.log("Block Number : ", blockNumber);
            ({numBlocksPerYear, epochLength, maxInflationRate, totalSupplyAtEpoch, epochBlockHeight} = await fetchEpochBlockInfo(near, blockNumber));
            const validatorRes = await near.connection.provider.validators(blockNumber);

            const totalSupply = totalSupplyAtEpoch.dividedBy(10**24);
            const rewardAtEpoch = totalSupply.times(((1+REWARD_PCT_PER_YEAR) ** (1/EPOCHS_A_YEAR) - 1));
            const treasuryRewardAtEpoch = Math.floor(rewardAtEpoch.times(PROTOCOL_REWARD_RATE).toNumber());
            const totalNearRewardAtEpoch =   Math.floor(totalSupply.times(maxInflationRate * numBlocksPerYear / epochLength));
            const validatorRewardAtEpoch = rewardAtEpoch - treasuryRewardAtEpoch; // totalNearRewardAtEpoch expression is broken, Then use rewardAtEpoch.
            const data = {}
            data.epoch = validatorRes.epoch_height
            data.blockHeight = validatorRes.epoch_start_height;
            data.validatorRewardAtEpoch = Math.round(validatorRewardAtEpoch);
            data.totalSupplyAtEpoch = totalSupplyAtEpoch / (10**24);
            table.push(data);
            blockNumber = validatorRes.epoch_start_height - 1;
        }
        catch(e){
            console.log("Fetch Block Error : ", e.message);
            if (e.message.includes("<html>") ){
                const json2csvParser = new Parser();
                const csv = json2csvParser.parse(table);
                fs.writeFileSync(`nearReward_${blockNumber}.csv`, csv);
                break;
            }
            blockNumber-=1;
        }
    }

    return {table, blockNumber};;
}


start = async (ready) => {
    let accountId = `${process.env.ACCOUNT}.near`
    console.log("1. initialize ===");
    const near = await initialize(accountId);
    if (ready){
        try {
          let {table, blockNumber} = await checkRewardStatus(near, LASTBLOCKNUMBER);
          console.log("Result table length : ", table.length);
          const json2csvParser = new Parser();
          const csv = json2csvParser.parse(table);
            fs.writeFileSync(`nearReward_${blockNumber}.csv`, csv);
            
        }
        catch(e){
            console.log("Error: ", e);
        }
    }
  };

start(true);