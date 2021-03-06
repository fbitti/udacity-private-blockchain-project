/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persistent storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const hex2ascii = require('hex2ascii');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't forget 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let height = self.chain.length;

                if (height > 0) {
                    block.previousBlockHash = self.chain[height - 1].hash;
                    block.height = height;
                } else {
                    // it is a Genesis block
                    block.height = 0;
                }
                block.time = Date.now().toString();
                block.hash = SHA256(JSON.stringify(block)).toString();
                self.chain.push(block);
                self.height++;
                resolve(block);
            } catch (error) {
                reject("Cannot add block " + block + "because of " + error);
            }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            let message = address + 
                        ":" + 
                        Date.now().toString().slice(0, -3) + 
                        ":starRegistry";
            resolve(message);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let chainValidationErrors = await self.validateChain();
            if (chainValidationErrors.length > 0) {
                reject(JSON.stringify(chainValidationErrors));
            }
            let messageTimestamp = parseInt(message.split(':')[1]);
            let currentTimeInSeconds = Date.now().toString().slice(0, -3);
            if (messageTimestamp > currentTimeInSeconds) {
                reject("Star submission error: the message timestamp cannot be in the future.");
            }
            if (currentTimeInSeconds - messageTimestamp < 300) {
                try {
                    if (bitcoinMessage.verify(message, address, signature)) {
                        let data = {};
                        data.owner = address;
                        data.star = star;
                        let block = new BlockClass.Block(data); 
                        self._addBlock(block);
                        resolve(block);
                    } else {
                        reject("Star submission error: The signature is not valid");
                    }
                } catch (error) {
                    reject(error);
                }
            } else {
                reject("Star submission error: The message to sign is older than 5 minutes");
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve) => {
            let block = self.chain.filter(b => b.hash == hash)[0];
            if (block) {
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve) => {
            let block = self.chain.filter(b => b.height === height)[0];
            if (block) {
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        let self = this;
        let stars = [];
        return new Promise((resolve) => {
            stars = self.chain
                        .filter(b => {
                            let decodedData = JSON.parse(hex2ascii(b.body));
                            return address == decodedData.owner;
                        });
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    async validateChain() {
        let self = this;
        let errorLog = [];
        let height = await self.getChainHeight();
        return new Promise(async (resolve) => {
            for (let i = 0; i <= height; i++) {
                self.chain[i]
                        .validate()
                        .then(isValid => {
                            if (!isValid) {
                                errorLog.push("Block " + i + " was tampered.")
                            }
                        });
            }
            resolve(errorLog);
        });
    }
}

module.exports.Blockchain = Blockchain;   