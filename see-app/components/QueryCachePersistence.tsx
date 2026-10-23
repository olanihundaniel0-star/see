import { useEffect, useLayoutEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { persistAccountQueries } from "@/lib/queryCache";

export function QueryCachePersistence({ account }: { account: string | null }) {
  const client = useQueryClient();
  const currentAccount = useRef(account);
  useLayoutEffect(() => { currentAccount.current = account; }, [account]);
  useEffect(() => {
    if (!account) return;
    const cache = persistAccountQueries(client, account, AsyncStorage);
    return () => { void cache.stop(currentAccount.current !== account); };
  }, [account, client]);
  return null;
}
