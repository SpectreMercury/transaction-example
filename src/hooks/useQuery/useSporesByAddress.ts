import { graphql } from '@/gql';
import { QuerySpore } from './type';
import { graphQLClient } from '@/utils/graphql';
import { useRefreshableQuery } from './useRefreshableQuery';
import { QueryOrder } from 'spore-graphql';

const sporesByAddressQueryDocument = graphql(`
  query GetSporesByAddress($address: String!, $order: QueryOrder) {
    spores(filter: { addresses: [$address] }, order: $order) {
      id
      contentType
      capacityMargin

      cell {
        cellOutput {
          capacity
          lock {
            args
            codeHash
            hashType
          }
        }
        outPoint {
          txHash
          index
        }
      }
    }
  }
`)

export function useSporesByAddressQuery(address: string | undefined, enabled = true, order = QueryOrder.Asc) {
  const { data, ...rest } = useRefreshableQuery(
    {
      queryKey: ['sporesByAddress', address, order],
      queryFn: async (ctx) => {
        return graphQLClient.request(
          sporesByAddressQueryDocument,
          { address: address!, order: order },
        );
      },
      enabled: !!address && enabled,
    },
    true,
  );
  const spores: QuerySpore[] = data?.spores ?? [];
  const isLoading = rest.isLoading;
  // dispatch(setSpores(spores))
  return {
    ...rest,
    data: spores,
    isLoading,
  };
}