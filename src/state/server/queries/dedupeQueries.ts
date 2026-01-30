import { useQuery } from "@tanstack/react-query";
import dedupeService from "@/services/dedupe";

export function useDedupeQuery() {
  return useQuery({
    queryKey: ["posts"], // Expo code used posts
    queryFn: () => dedupeService.getPosts(),
  });
}
