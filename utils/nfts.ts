import { Connection, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import axios from "axios"
import { programs } from "@metaplex/js"

export type NFT = {
  pubkey?: PublicKey
  mint: PublicKey
  onchainMetadata: programs.metadata.MetadataData
  externalMetadata: {
    attributes: Array<any>
    collection: any
    description: string
    edition: number
    external_url: string
    image: string
    name: string
    properties: {
      files: Array<string>
      category: string
      creators: Array<{
        pubKey: string
        address: string
      }>
    }
    seller_fee_basis_points: number
  }
  metadataPDA: PublicKey
}

const {
  metadata: { Metadata },
} = programs

export async function getNFTMetadata(
  mint: string,
  conn: Connection,
  pubkey?: string
): Promise<NFT | undefined> {
  try {
    const metadataPDA = await Metadata.getPDA(mint)
    const onchainMetadata = (await Metadata.load(conn, metadataPDA)).data
    const externalMetadata = (await axios.get(onchainMetadata.data.uri)).data

    return {
      pubkey: pubkey ? new PublicKey(pubkey) : undefined,
      mint: new PublicKey(mint),
      onchainMetadata,
      externalMetadata,
      metadataPDA,
    }
  } catch (e) {
    console.log(`failed to pull metadata for token ${mint}`)
  }
}

export async function getNFTMetadataForMany(
  tokens: any[],
  conn: Connection
): Promise<NFT[]> {
  const promises: Promise<NFT | undefined>[] = []
  tokens.forEach((token) =>
    promises.push(getNFTMetadata(token.mint, conn, token.pubkey))
  )
  const nfts = (await Promise.all(promises)).filter((n) => !!n)

  return nfts as NFT[]
}

/**
 *
 * @author https://github.com/gemworks/gem-farm/tree/main/app/gem-farm
 */
export async function getNFTsByOwner(
  owner: PublicKey,
  conn: Connection
): Promise<NFT[]> {
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  })

  const tokens = tokenAccounts.value
    .filter((tokenAccount) => {
      const amount = tokenAccount.account.data.parsed.info.tokenAmount

      return amount.decimals === 0 && amount.uiAmount === 1
    })
    .map((tokenAccount) => {
      return {
        pubkey: tokenAccount.pubkey,
        mint: tokenAccount.account.data.parsed.info.mint,
      }
    })

  return await getNFTMetadataForMany(tokens, conn)
}
