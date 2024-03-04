import { WitnessArgs, blockchain } from "@ckb-lumos/base";
import { bytes } from "@ckb-lumos/codec";
import { bytify, hexify } from "@ckb-lumos/codec/lib/bytes";
import { predefined } from "@ckb-lumos/config-manager";
import { Address, BI, Cell, Hash, HexString, Indexer, RPC, Script, Transaction, commons, config, hd, helpers } from "@ckb-lumos/lumos"

export const CONFIG = config.predefined.AGGRON4;
config.initializeConfig(CONFIG);

console.log(CONFIG);

const CKB_RPC_URL = "https://testnet.ckb.dev/rpc";
const rpc = new RPC(CKB_RPC_URL);
const indexer = new Indexer(CKB_RPC_URL);

export interface Secp256k1Wallet {
  lock: Script;
  address: Address;
  signMessage(message: HexString): Hash;
  signTransaction(txSkeleton: helpers.TransactionSkeletonType): helpers.TransactionSkeletonType;
  signAndSendTransaction(txSkeleton: helpers.TransactionSkeletonType): Promise<Hash>;
}

export interface TransferOptions {
  from: string;
  to: string;
  amount: string;
}

interface Options {
  from: string;
  to: string;
  amount: string;
  privKey: string;
  balance: string;
}

//@ts-ignore
const ethereum = typeof window !== 'undefined' ? (window.ethereum as EthereumProvider) : undefined;

const SECP_SIGNATURE_PLACEHOLDER = hexify(
    new Uint8Array(
        commons.omnilock.OmnilockWitnessLock.pack({
        signature: new Uint8Array(65).buffer,
        }).byteLength
    )
);


export const generateAddressFromPrivateKey = (privateKey: HexString) => {
  const pubKey = hd.key.privateToPublic(privateKey);
  const args = hd.key.publicKeyToBlake160(pubKey);
  const template = CONFIG.SCRIPTS["SECP256K1_BLAKE160"]!;
  const lockScript: Script = {
    codeHash: template.CODE_HASH,
    hashType: template.HASH_TYPE,
    args: args,
  };
  const address = helpers.encodeToAddress(lockScript, { config: CONFIG });
  return {
    lockScript,
    address,
    pubKey,
  };   
}

export async function capacityOf(address: string): Promise<BI> {
  const collector = indexer.collector({
    lock: helpers.parseAddress(address),
  });
  let balance = BI.from(0);
  for await (const cell of collector.collect()) {
    balance = balance.add(cell.cellOutput.capacity);
  }
  return balance;
}

export function formatString(str: string, maxLen: number = 15): string {
  if (str.length > maxLen) {
    return `${str.slice(0, 8)}......${str.slice(-8)}`;
  }
  return str;
}

export async function buildTransfer(options: TransferOptions) {
  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: indexer });
  const fromScript = helpers.parseAddress(options.from);
  const fromAddress = helpers.encodeToAddress(fromScript, { config: CONFIG });
  const toScript = helpers.parseAddress(options.to);
  const toAddress = helpers.encodeToAddress(toScript, { config: CONFIG });
  txSkeleton = await commons.common.transfer(
    txSkeleton,
    [fromAddress],
    toAddress,
    BigInt(70 * 10 ** 8),
    undefined,
    undefined,
    { config: CONFIG }
  );
  txSkeleton = await commons.common.payFee(txSkeleton, [fromAddress], 1000, undefined, { config: CONFIG });
  return txSkeleton;
}

export async function signByPrivateKey(txSkeleton: helpers.TransactionSkeletonType, privateKey: string) {
  txSkeleton = commons.common.prepareSigningEntries(txSkeleton);
  const message = txSkeleton.get("signingEntries").get(0)!.message;
  const signature = hd.key.signRecoverable(message, privateKey);
  const packedSignature = hexify(
    commons.omnilock.OmnilockWitnessLock.pack({
      signature: signature,
    })
  );
  const signedTx = helpers.sealTransaction(txSkeleton, [packedSignature]);
  return signedTx;
}

export async function sendTransaction(tx: Transaction): Promise<Hash> {
  return rpc.sendTransaction(tx, "passthrough");
}

export async function transfer(options: Options): Promise<string> {
  const block = await rpc.getBlockByNumber("0x0");
  let AGGRON4: config.Config = config.predefined.AGGRON4;
  AGGRON4 = { PREFIX: "ckt", SCRIPTS: config.generateGenesisScriptConfigs(block) };

  let txSkeleton = helpers.TransactionSkeleton({});
  const fromScript = helpers.parseAddress(options.from, { config: AGGRON4 });
  const toScript = helpers.parseAddress(options.to, { config: AGGRON4 });

  // additional 0.001 ckb for tx fee
  // the tx fee could calculated by tx size
  // this is just a simple example
  const neededCapacity = BI.from(options.amount).add(10000);
  let collectedSum = BI.from(0);
  const collected: Cell[] = [];
  const collector = indexer.collector({ lock: fromScript, type: "empty" });
  for await (const cell of collector.collect()) {
    collectedSum = collectedSum.add(cell.cellOutput.capacity);
    collected.push(cell);
    if (collectedSum >= neededCapacity) break;
  }
    
  if (collectedSum < neededCapacity) {
    throw new Error("Not enough CKB");
  }

  const transferOutput: Cell = {
    cellOutput: {
      capacity: BI.from(options.amount).toHexString(),
      lock: toScript,
    },
    data: "0x",
  };

  const changeOutput: Cell = {
    cellOutput: {
      capacity: collectedSum.sub(neededCapacity).toHexString(),
      lock: fromScript,
    },
    data: "0x",
  };

  txSkeleton = txSkeleton.update("inputs", (inputs) => inputs.push(...collected));
  txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(transferOutput, changeOutput));
  txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
    cellDeps.push({
      outPoint: {
        txHash: AGGRON4!!.SCRIPTS!!.SECP256K1_BLAKE160!!.TX_HASH,
        index: AGGRON4!!.SCRIPTS!!.SECP256K1_BLAKE160!!.INDEX,
      },
      depType: AGGRON4!!.SCRIPTS!!.SECP256K1_BLAKE160!!.DEP_TYPE,
    })
  );

  const firstIndex = txSkeleton
    .get("inputs")
    .findIndex((input) =>
      bytes.equal(blockchain.Script.pack(input.cellOutput.lock), blockchain.Script.pack(fromScript))
    );
  if (firstIndex !== -1) {
    while (firstIndex >= txSkeleton.get("witnesses").size) {
      txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.push("0x"));
    }
    let witness: string = txSkeleton.get("witnesses").get(firstIndex)!;
    const newWitnessArgs: WitnessArgs = {
      /* 65-byte zeros in hex */
      lock: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    };
    if (witness !== "0x") {
      const witnessArgs = blockchain.WitnessArgs.unpack(bytes.bytify(witness));
      const lock = witnessArgs.lock;
      if (!!lock && !!newWitnessArgs.lock && !bytes.equal(lock, newWitnessArgs.lock)) {
        throw new Error("Lock field in first witness is set aside for signature!");
      }
      const inputType = witnessArgs.inputType;
      if (!!inputType) {
        newWitnessArgs.inputType = inputType;
      }
      const outputType = witnessArgs.outputType;
      if (!!outputType) {
        newWitnessArgs.outputType = outputType;
      }
    }
    witness = bytes.hexify(blockchain.WitnessArgs.pack(newWitnessArgs));
    txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.set(firstIndex, witness));
  }

  txSkeleton = commons.common.prepareSigningEntries(txSkeleton);
  const message = txSkeleton.get("signingEntries").get(0)?.message;
  const Sig = hd.key.signRecoverable(message!, options.privKey);
  const tx = helpers.sealTransaction(txSkeleton, [Sig]);
  
  console.log(tx);

  const hash = await rpc.sendTransaction(tx, "passthrough");


  console.log("The transaction hash is", hash);

  return hash;
}