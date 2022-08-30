#!/bin/bash

in_names=(
    "PEther"
    "PErc20"
    "Controller"
    "PriceOracle"
    "ERC20"
    "Registry"
    "oldFactory"
    "PTokenFactory"
    "chainLink"
    "InterestRateModel"
    "Governor"
)

out_names=(
    "cETHAbi"
    "cERC20Abi"
    "comptrollerAbi"
    "priceOracleAbi"
    "ERC20Abi"
    "registryAbi"
    "oldFactoryAbi"
    "newFactoryAbi"
    "chainLinkAbi"
    "interestRateModelAbi"
    "govAbi"
)

path=$(pwd)/exp_files/
    
abi_path=$(pwd)/data/abi/

main() {
    rm -rf data

    yarn run hardhat export-abi

    rm -rf "$path" 
    
    mkdir "$path"

    i=0
    for name in ${out_names[@]}; do

        path_to_json=${abi_path}${in_names[$i]}.json

        if test -e $path_to_json; then

            printf "export const %s =" $name >> $path$name.ts

            cat $path_to_json >> $path$name.ts

        else
            echo "WARNING! Abi for ${in_names[$i]} not found. Skipping abi update."
        fi
        
        i=$((i+1))
    done

    echo "SUCCESS"
}

main