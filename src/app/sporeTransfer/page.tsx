"use client"

import { connect, initConfig } from "@joyid/ckb";
import React, { useEffect, useState } from "react";
import { capacityOf, formatString } from "../lib";
import { useSporesByAddressQuery } from "@/hooks/useQuery/useSporesByAddress";
import CreateSporeModal from "../_components/CreateSporeModal/CreateSporeModal";
import BigNumber from "bignumber.js";
import { sharedPrivateKey } from "../sharedPrivateKey";
import { createSecp256k1Wallet } from "../wallet";
import { sporeConfig } from "@/utils/config";
import { getSporeById, transferSpore } from "@spore-sdk/core";
import { OutPoint } from '../../gql/graphql';
import { helpers } from "@ckb-lumos/lumos";

const SporeTransfer: React.FC = () => {
    const [address, setAddress] = useState<string>("");
    const account = createSecp256k1Wallet(sharedPrivateKey.CHARLIE, sporeConfig)
    const [accountBalance, setAccountBalance] = useState<string>("");
    const [isCreateModal, setIsCreateModal] = useState<boolean>(false);

    initConfig({
        name: "Spore Tutorial",
        logo: "https://fav.farm/🆔",
        joyidAppURL: "https://testnet.joyid.dev",
    });

    const getCapacity = async (address: string) => {
        let balance = await capacityOf(address);
        let capacity = Math.floor(new BigNumber(balance.toString()).toNumber() / 10 ** 8)
        setAccountBalance(balance.div(10 ** 8).toString())
        return balance
    }

    const changeModalStatus = () => {
        setIsCreateModal(!isCreateModal);
    }

    const { data: spores, isLoading: isSporesLoading } = useSporesByAddressQuery(
        account.address as string,
    );

    let connectJoyID = async() => {
        let rlt = await connect();
        setAddress(rlt.address);
    }

    const _transferSpore = async (id: string) => {

        if(!address) {
            alert("connect you wallet first");
        }

        const sporeCell = await getSporeById(id, sporeConfig)

        const { txSkeleton, outputIndex } = await transferSpore({
            outPoint: sporeCell.outPoint!,
            fromInfos: [account.address],
            toLock: helpers.parseAddress(address, {config: sporeConfig.lumos}),
            config: sporeConfig,
        });

        const txHash = await account.signAndSendTransaction(txSkeleton);
        console.log(txHash);
    }

    useEffect(() => {
        getCapacity(account.address)
    }, [])
 
    return (
        <div className="bg-white w-[100vh] h-[100%] flex justify-center items-center">
            { isCreateModal && <CreateSporeModal closeModal={changeModalStatus} /> }
            <div className="w-[49%] flex flex-col gap-4">
                <div className=" font-extrabold text-3xl">Charlie Account</div>
                <div className="text-xl">Charlie Balance: {accountBalance}</div>
                <div className="flex flex-wrap gap-4">
                    {spores && spores.length > 0 &&
                        spores.map((spore) => {
                            return (
                                <div key={spore.id} 
                                    className="flex flex-col px-2 items-center w-48 border-2 rounded-md border-gray-600">
                                    <img alt={spore.id} className="w-24 h-24 mt-4" src={`/api/media/${spore.id}`} />
                                    <button 
                                        className="w-full h-8 bg-black text-white rounded-md my-4"
                                        onClick={() => {
                                            _transferSpore(spore.id)
                                        }}
                                    > Transfer To JoyID </button>
                                </div>
                            )
                        })
                    }
                    {
                        !spores || spores.length === 0 && 'No spore currently, create it now！'
                    }
                    
                </div>
                <button 
                    className="w-36 h-12 bg-JoyIDGreen text-JoyIDGray rounded-md font-extrabold" 
                    onClick={changeModalStatus}
                >Create Spore</button>
            </div>
            {/* <div className="w-[49%] flex justify-center">
                {
                    !address && (<button className=" w-24 h-12 bg-JoyIDGreen text-JoyIDGray rounded-md font-extrabold" onClick={connectJoyID}>connect</button>)
                }
                {
                    address && (
                        <>
                            <div>
                                <div className="">address: {formatString(address)}</div>
                            </div>
                        </>
                    )
                }
            </div> */}
            
        </div>
    )
}

export default SporeTransfer