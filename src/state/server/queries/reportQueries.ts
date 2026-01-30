import { queryOptions } from "@tanstack/react-query";
import reportService from "@/services/report";

export const reportQueries = {
  all: () => ["reports"] as const,
  list: () =>
    queryOptions({
      queryKey: reportQueries.all(),
      queryFn: () => reportService.getReports(),
    }),
};
