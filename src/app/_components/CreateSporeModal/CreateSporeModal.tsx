"use client"

import { enqueueSnackbar } from "notistack";
import React, { useCallback, useEffect, useState } from "react";
import { useDropzone } from 'react-dropzone';
import Image from "next/image";
import useEstimatedOnChainSize from "@/hooks/useEstimatedOnChainSize/useEstimatedOnChainSize";
import { BI, helpers } from "@ckb-lumos/lumos";
import { SporeConfig, createSpore } from '@spore-sdk/core';
import { sporeConfig } from '@/utils/config';
import useWalletBalance from "@/hooks/useBalance";
import { useMutation } from "@tanstack/react-query";
import { getMIMETypeByName } from "@/utils/mime";
import { sharedPrivateKey } from "@/app/sharedPrivateKey";
import { createSecp256k1Wallet } from "@/app/wallet";


interface UploadedImage {
  file: File;
  preview: string;
}

interface ModalProps {
  closeModal: () => void;
}

const CreateSporeModal: React.FC<ModalProps> = ({closeModal}) => {
    const CharliePrivateKey = sharedPrivateKey.CHARLIE 
    const account = createSecp256k1Wallet(CharliePrivateKey, sporeConfig);
    const [file, setFile] = useState<File | null>(null);
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const [capacityList, setCapacityList] = useState<number[]>([]);
    const [clusterId, setClusterId] = useState(undefined)
    const balance = useWalletBalance(account.address)
    const onChainSize = useEstimatedOnChainSize(
      clusterId,
      file,
      createSecp256k1Wallet(sharedPrivateKey.CHARLIE, sporeConfig).address,
      helpers.parseAddress(account.address, {config: sporeConfig.lumos}),
      false,
    );
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const newFile = acceptedFiles[0];

        if (!newFile) return;

        if (newFile.size > 300 * 1024) {
            enqueueSnackbar('File size exceeds 300 KB', { variant: 'error' });
            return;
        }

        setUploadedImages([{ file: newFile, preview: URL.createObjectURL(newFile) }]);
        setFile(newFile);
    }, []);

    const handleRemoveImage = (index: number) => {
        setFile(null);
        setUploadedImages(current => current.filter((_, idx) => idx !== index));
        setCapacityList(currentList => currentList.filter((_, idx) => idx !== index));
    };
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const addSpore = useCallback(
      async (...args: Parameters<typeof createSpore>) => {
        console.log(account.address);
        let { txSkeleton, outputIndex } = await createSpore(...args);
        const txHash = await account.signAndSendTransaction(txSkeleton);
        const outputs = txSkeleton.get('outputs');
        const spore = outputs.get(outputIndex);
        console.log(spore);
        return spore;
      },
      [account],
    );

    const addSporeMutation = useMutation({
      mutationFn: addSpore,
    });  
    const handleSubmit = useCallback(
      async (
        content: Blob | null,
        clusterId: string | undefined,
        useCapacityMargin?: boolean,
      ) => {
        if (!content || !account.address) {
          return;
        }
        try {
          const contentBuffer = await content.arrayBuffer();
          const contentType = content.type || getMIMETypeByName(content.type);
          const spore = await addSporeMutation.mutateAsync({
            data: {
              contentType,
              content: new Uint8Array(contentBuffer),
              clusterId,
            },
            fromInfos: [account.address],
            toLock: helpers.parseAddress(account.address, {config: sporeConfig.lumos}),
            config: sporeConfig,
            // @ts-ignore
            capacityMargin: BI.from(100_000_000) ,
          });
          console.log(spore);
          // enqueueSnackbar('Gift Mint Successful', { variant: 'success' });
        } catch (error) {
          console.error(error)
          // enqueueSnackbar('An error occurred', { variant: 'error' });
        } finally {
          closeModal()
        }
      },
      [account.address, addSporeMutation],
    );

    return (
        <div className=" absolute w-96 border-2 rounded-lg bg-white">
            <div className="mt-4 ml-4 font-semibold">Upload Image for Mint Spore</div>
            <div 
                {...getRootProps()} 
                className="px-4 mx-4 cursor-pointer bg-primary008 border-dashed h-[232px] rounded-md border-2 border-gray-300 p-4 mt-4 text-center"
            >
                <input {...getInputProps()} />
                {
                <div className='h-full flex flex-col items-center justify-center'>
                <Image
                    src='/svg/upload-img.svg'
                    width={88}
                    height={88}
                    alt='Upload image to mint as Gift'/>
                    {!isDragActive &&
                    <>
                        <p className='mt-6 mb-2 text-white001 font-SourceSanPro underline text-body1bdmb'>Upload an image as Gift</p>
                        <p className='text-white003 font-SourceSanPro text-labelmb'>Maximum file size: 300 KB</p>
                    </>
                    }
                </div>
                }
            </div>
            <div className="mt-4 px-4 max-h-[300px] overflow-auto">
              {uploadedImages.map((image, index) => (
                <div key={index} className=" bg-gray-300 px-4 py-6 rounded-md flex items-center justify-between my-2">
                  <div className='flex gap-4 items-center'>
                    <img src={image.preview} alt={`uploaded ${index}`} className="w-16 h-16 object-cover" />
                    <div>
                      <p className='w-32 text-white001 text-body1mb font-SourceSanPro overflow-hidden overflow-ellipsis whitespace-nowrap'>{image.file.name}</p>
                      <p className='text-white003 text-labelmb font-SourceSanPro'> ~ { onChainSize + 61 } CKB</p>
                    </div>
                  </div>
                  <div className='cursor-pointer' onClick={() => handleRemoveImage(index)}>
                    <Image 
                      src='/svg/remove-upload.svg'
                      width={32}
                      height={32}
                      alt='remove-upload'
                    />
                  </div>
                </div>
              ))}
              {file && balance === 0 && 
          <div 
            className='text-light-error-function font-SourceSanPro text-sm'>
              Not enough CKB in your wallet.
          </div>
        }
        {file && 
          <div className='flex flex-col items-center mt-6'>
            <div className='flex items-center mb-2'>
              <div className='text-white003 font-SourceSanPro text-labelmb mr-2'>Total On-Chain Cost: </div>
              <div className='text-white001 font-SourceSanPro text-labelbdmb'>{` ~${onChainSize + 61  } CKB`}</div>
            </div>
            {balance - onChainSize - 61 >= 1 ?
              <></>
              :
              <div className='text-light-error-function font-SourceSanPro text-labelmb'>Not enough CKB in your wallet</div>
            }
          </div>
        }
        <div className="px-4 pb-4">
          <button 
            className="w-full h-12 bg-slate-500 rounded-md"
            disabled={!file || balance - onChainSize - 61 < 1} onClick={async () => {
            await handleSubmit(file, undefined, true)}}> 
            Create 
          </button>
        </div>
      </div>
      </div>
    )
}

export default CreateSporeModal