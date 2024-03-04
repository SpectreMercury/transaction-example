"use client"

import { useEffect, useState } from "react";
import { sharedPrivateKey } from './sharedPrivateKey';
import { buildTransfer, capacityOf, formatString, generateAddressFromPrivateKey, sendTransaction, signByPrivateKey, transfer } from "./lib";
import { BI, HexString, helpers } from '@ckb-lumos/lumos';
import { enqueueSnackbar } from "notistack";
import Image from "next/image";
import BigNumber from 'bignumber.js';

export default function Home() {
  
  const AlicePrivateKey = sharedPrivateKey.ALICE
  const CharliePrivateKey = sharedPrivateKey.CHARLIE 
  const [aliceAddress, setAliceAddress] = useState<string>("");
  const [charlieAddress, setCharlieAddress] = useState<string>(""); 
  const [aliceBalance, setAliceBalance] = useState<number>();
  const [charlieBalance, setCharlieBalance] = useState<number>();
  const [aliceAmount, setAliceAmount] = useState<string>()
  const [charlieAmount, setCharlieAmount] = useState<string>()

  const setUserAddress = (pk: HexString, k: string) => {
    let { address } = generateAddressFromPrivateKey(pk);
    getCapacity(address, k);
    return address
  }

  const handleCopy = async (textToCopy: string) => {
    await navigator.clipboard.writeText(textToCopy);
  };

  const getCapacity = async (address: string, k: string) => {
    console.log(address);
    let balance = await capacityOf(address);
    let capacity = Math.floor(new BigNumber(balance.toString()).toNumber() / 10 ** 8)
    if (k === 'alice') {
      setAliceBalance(capacity);
    } else if (k === 'charlie') {
      setCharlieBalance(capacity);
    }
    return balance
  }

  const TransferCKB = async (privateKey: string, from: string, to: string,  amount: string) => {
    let txSkeleton = await buildTransfer({
      from,
      to,
      amount
    })

    console.log('txSkeleton', txSkeleton)

    let signTxHash = await signByPrivateKey(txSkeleton, privateKey);

    console.log('signTxHash', signTxHash)
    
    let txHash = await sendTransaction(signTxHash);
    console.log(txHash);
  }

  useEffect(() => {
    setAliceAddress(setUserAddress(AlicePrivateKey, 'alice'));
    setCharlieAddress(setUserAddress(CharliePrivateKey, 'charlie'));
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-between bg-white">
      <div className="w-[50%] text-white p-8">
        <div className="text-4xl text-black">Alice</div>
        <div className="text-lg mt-4 text-black">Balance: { aliceBalance ? aliceBalance : '-----' } CKB</div>
        <div className="flex gap-4 mt-4 items-center">
          <div className="text-lg text-black">address: { formatString(aliceAddress) }</div>

          <div 
            className="w-8 h-8 flex justify-center items-center bg-black rounded-lg cursor-pointer"
            onClick={async () => {
              await handleCopy(aliceAddress)
            }}
          >
            <Image
            src='/svg/icon-copy.svg'
            width={18}
            height={18}
            alt='Copy address'
          />
          </div>
        </div>
        <div className="text-lg text-black mt-4">Transfer to <b className=" text-ex">Charlie</b></div>
        <input
          type="number"
          value={aliceAmount}
          onChange={(e) => {
            setAliceAmount(e.target.value)
          }}
          className=" w-80 h-12 rounded-md mt-4 text-black px-2 border-black border-2"
        ></input>
        <div 
          onClick={( )=> {
            if (!aliceAmount || !aliceBalance) return
            console.log(aliceAmount);
            transfer({
              from: aliceAddress,
              to: charlieAddress,
              amount: BI.from(parseFloat(aliceAmount) * 10 ** 8).toString(),
              privKey: sharedPrivateKey.ALICE,
              balance: BI.from(parseFloat(JSON.stringify(aliceBalance)) * 10 ** 8).toString()
            })
          }}
          className="mt-4 w-80 h-16 flex justify-center items-center text-sm bg-black rounded-md cursor-pointer"
        >Transfer</div>
      </div>
      <div className="w-[50%] text-white p-8">
        <div className="text-4xl text-black">Charlie</div>
        <div className="text-lg mt-4 text-black">Balance: { charlieBalance ? charlieBalance : '----' } CKB</div>
        <div className="flex gap-4 mt-4 items-center">
          <div className="text-lg text-black">address: { formatString(charlieAddress) }</div>
          <div 
            className="w-8 h-8 flex justify-center items-center bg-black rounded-lg cursor-pointer"
            onClick={async () => {
              await handleCopy(charlieAddress)
            }}
          >
            <Image
            src='/svg/icon-copy.svg'
            width={18}
            height={18}
            alt='Copy address'
          />
          </div>
        </div>
        <div className="text-lg text-black mt-4">Transfer to <b className=" text-ex">Alice</b></div>
        <input
          type="number"
          value={charlieAmount}
          onChange={(e) => {
            setAliceAmount(e.target.value)
          }}
          className=" w-80 h-12 rounded-md mt-4 text-black px-2 border-black border-2"
        ></input>
        <div className="mt-4 w-80 h-16 flex justify-center items-center text-sm bg-black rounded-md cursor-pointer"
          onClick={( )=> {
            if (!charlieAmount || !charlieBalance) return
            console.log(aliceAmount);
            transfer({
              from: charlieAddress,
              to: aliceAddress,
              amount: BI.from(parseFloat(charlieAmount) * 10 ** 8).toString(),
              privKey: sharedPrivateKey.CHARLIE,
              balance: BI.from(parseFloat(JSON.stringify(charlieBalance)) * 10 ** 8).toString()
            })
          }}
        >Transfer</div>
      </div>
    </main>
  );
}
