import {Event} from '../Event';
import {World} from '../World';
import {InterestRateModel} from '../Contract/InterestRateModel';
import {Invokation} from '../Invokation';
import {
  getAddressV,
  getExpNumberV,
  getPercentV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  NumberV,
  StringV,
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {storeAndSaveContract} from '../Networks';
import {getContract, getTestContract} from '../Contract';

const FixedInterestRateModel = getTestContract('InterestRateModelHarness');
const BaseInterestRateModel = getContract('BaseInterestRateModel');
const JumpRateModel = getContract('JumpRateModel');

export interface InterestRateModelData {
  invokation: Invokation<InterestRateModel>
  address?: string
  name: string
  contract: string
  description: string
  base?: string
  slope?: string
  kink?: string
  jump?: string
}

export async function buildInterestRateModel(world: World, from: string, event: Event): Promise<{world: World, interestRateModel: InterestRateModel, interestRateModelData: InterestRateModelData}> {
  const fetchers = [
    new Fetcher<{name: StringV, rate: NumberV}, InterestRateModelData>(`
        #### Fixed

        * "Fixed name:<String> rate:<Number>" - Fixed interest **per-block** rate
          * E.g. "InterestRateModel Deploy Fixed MyInterestRateModel 0.5"
      `,
      "Fixed",
      [
        new Arg("name", getStringV),
        new Arg("rate", getPercentV),
      ],
      async (world, {name, rate}) => ({
        invokation: await FixedInterestRateModel.deploy<InterestRateModel>(world, from, [rate.encode()]),
        name: name.val,
        contract: "InterestRateModelHarness",
        description: `Fixed rate ${rate.show()} per block`
      })
    ),

    new Fetcher<{name: StringV, baseRate: NumberV, multiplier: NumberV}, InterestRateModelData>(`
        #### BaseModel

        * "BaseModel name:<String> baseRate:<Number> multiplier:<Number>" - The BaseModel interest rate
          * E.g. "InterestRateModel Deploy BaseModel MyInterestRateModel 0.05 0.2" - 5% base rate and 20% utilization multiplier
      `,
      "BaseModel",
      [
        new Arg("name", getStringV),
        new Arg("baseRate", getExpNumberV),
        new Arg("multiplier", getExpNumberV)
      ],
      async (world, {name, baseRate, multiplier}) => ({
        invokation: await BaseInterestRateModel.deploy<InterestRateModel>(world, from, [baseRate.encode(), multiplier.encode()]),
        name: name.val,
        contract: "BaseInterestRateModel",
        description: `BaseModel baseRate=${baseRate.encode().toString()} multiplier=${multiplier.encode().toString()}`,
        base: baseRate.encode().toString(),
        slope: multiplier.encode().toString()
      })
    ),

    new Fetcher<{name: StringV, baseRate: NumberV, multiplier: NumberV, jump: NumberV, kink: NumberV}, InterestRateModelData>(`
         #### JumpRateModel

         * "JumpRateModel name:<String> baseRate:<Number> multiplier:<Number> jump:<Number> kink:<Number>" - The Jump interest rate
           * E.g. "InterestRateModel Deploy JumpRateModel MyInterestRateModel 0.05 0.2 2 0.90" - 5% base rate and 20% utilization multiplier and 200% multiplier at 90% utilization
       `,
       "JumpRateModel",
       [
         new Arg("name", getStringV),
         new Arg("baseRate", getExpNumberV),
         new Arg("multiplier", getExpNumberV),
         new Arg("jump", getExpNumberV),
         new Arg("kink", getExpNumberV)
       ],
       async (world, {name, baseRate, multiplier, jump, kink}) => ({
         invokation: await JumpRateModel.deploy<InterestRateModel>(world, from, [baseRate.encode(), multiplier.encode(), jump.encode(), kink.val]),
         name: name.val,
         contract: "JumpRateModel",
         description: `JumpRateModel baseRate=${baseRate.encode().toString()} multiplier=${multiplier.encode().toString()} jump=${jump.encode().toString()} kink=${kink.encode().toString()}`,
         base: baseRate.encode().toString(),
         slope: multiplier.encode().toString(),
         jump: jump.encode().toString(),
         kink: kink.encode().toString()
       })
    )
  ];

  let interestRateModelData = await getFetcherValue<any, InterestRateModelData>("DeployInterestRateModel", fetchers, world, event);
  let invokation = interestRateModelData.invokation;
  delete interestRateModelData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }
  const interestRateModel = invokation.value!;
  interestRateModelData.address = interestRateModel._address;

  world = await storeAndSaveContract(
    world,
    interestRateModel,
    interestRateModelData.name,
    invokation,
    [
      {
        index: ['InterestRateModel', interestRateModelData.name],
        data: interestRateModelData
      }
    ]
  );

  return {world, interestRateModel, interestRateModelData};
}
