import { Contract } from '@ethersproject/contracts'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'
import { TokenAmount } from './entities/fractions/tokenAmount'
import { Pair } from './entities/pair'
import ISunSwapPair from '@congson1907/sunswap-core/artifacts/contracts/interfaces/ISunSwapPair.sol/ISunSwapPair.json'
import invariant from 'tiny-invariant'
import ERC20 from './abis/ERC20.json'
import { ChainId } from './constants'
import { Token } from './entities/token'

let TOKEN_DECIMALS_CACHE: { [chainId: number]: { [address: string]: number } } = {
  [ChainId.MAINNET]: {
    '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A': 9, // DGD
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18, // WETH
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 18, // USDT
    '0xb6ed7644c69416d67b522e20bc294a9a9b405b31': 8, // 0xBTC
    '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6 // USDC
  },
  [ChainId.POLYGON_MUMBAI]:{
    '0xFAd46E603A294a0eAc73DDC02D7ef30443a89414': 18, // WETH
    '0xd55D28217fc399D588467B92DFF9D4AAD65B0fE8': 18, // SHIB
    '0x3C0F3004631a99F7b96F59710e093Aa13a35E9B0': 18, // BNB
    '0x7a5BBb6463D7eD92d061C4F193998a025317c025': 18, // DAI
    '0x73a9078a90C7317698c3eb5071E71BF4e428fAE3': 6, // USDC
    '0x55489cBeBBd99B3Ba7052b8455d2ACD34C237fBC': 6, // USDT
    '0x588B1C7be2658a6AD7f84a8C05ec8acA0283B1d1': 18, // LINK
    '0xD0dc0493b4BD8b44C3bEdc0cE8A7b8d88D1461d6': 18, // WMATIC
    '0x49232F8d245e948D65F1Bb3b45280E7e824529fC': 18 // WBNB
  },
  [ChainId.BINANCE_TESTNET]:{
    '0x78682DfDEEc85ff41753c04F37Ccc2Bd31631aE3': 18, // WMATIC
    '0xd85b424B406E8C6AE51dD1884a4A7Dad24D02bd4': 18 // WBNB
  }
}

/**
 * Contains methods for constructing instances of pairs and tokens from on-chain data.
 */
export abstract class Fetcher {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  /**
   * Fetch information for a given token on the given chain, using the given ethers provider.
   * @param chainId chain of the token
   * @param address address of the token on the chain
   * @param provider provider used to fetch the token
   * @param symbol optional symbol of the token
   * @param name optional name of the token
   */
  public static async fetchTokenData(
    chainId: ChainId,
    address: string,
    provider = getDefaultProvider(getNetwork(chainId)),
    symbol?: string,
    name?: string
  ): Promise<Token> {
    const parsedDecimals =
      typeof TOKEN_DECIMALS_CACHE?.[chainId]?.[address] === 'number'
        ? TOKEN_DECIMALS_CACHE[chainId][address]
        : await new Contract(address, ERC20, provider).decimals().then((decimals: number): number => {
            TOKEN_DECIMALS_CACHE = {
              ...TOKEN_DECIMALS_CACHE,
              [chainId]: {
                ...TOKEN_DECIMALS_CACHE?.[chainId],
                [address]: decimals
              }
            }
            return decimals
          })
    return new Token(chainId, address, parsedDecimals, symbol, name)
  }

  /**
   * Fetches information about a pair and constructs a pair from the given two tokens.
   * @param tokenA first token
   * @param tokenB second token
   * @param provider the provider to use to fetch the data
   */
  public static async fetchPairData(
    tokenA: Token,
    tokenB: Token,
    provider = getDefaultProvider(getNetwork(tokenA.chainId))
  ): Promise<Pair> {
    invariant(tokenA.chainId === tokenB.chainId, 'CHAIN_ID')
    const address = Pair.getAddress(tokenA, tokenB)
    const [reserves0, reserves1] = await new Contract(address, ISunSwapPair.abi, provider).getReserves()
    const balances = tokenA.sortsBefore(tokenB) ? [reserves0, reserves1] : [reserves1, reserves0]
    return new Pair(new TokenAmount(tokenA, balances[0]), new TokenAmount(tokenB, balances[1]))
  }
}
