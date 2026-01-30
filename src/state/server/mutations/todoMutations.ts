import { useMutation, useQueryClient } from "@tanstack/react-query";
import todoService from "@/services/todo";

export function useTodoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["todos", "add"],
    mutationFn: (variables: string) => todoService.postTodo(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
    onError: (error) => {
      console.error("Failed to add todo:", error);
    },
  });
}
