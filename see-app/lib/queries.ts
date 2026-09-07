import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type JobStatus = "bookmarked" | "applied" | "interviewing" | "offer" | "rejected";
export type Job = {
  id: string;
  company: string;
  role: string;
  salary_range: string | null;
  status: JobStatus;
  deadline: string | null;
  applied_at: string;
  updated_at: string;
  checklists: { id: string; title: string; is_completed: boolean }[];
};
export type Note = { id: string; title: string; content: string; tags: string | null; created_at: string; updated_at: string };
export type Event = {
  id: string;
  source: string;
  title: string;
  description: string | null;
  url: string;
  location: string | null;
  is_virtual: boolean;
  categories: string[] | null;
  prize_pool: string | null;
  start_date: string;
  end_date: string | null;
};
export type DashboardItem = {
  kind: "reminder" | "job";
  id: string;
  title: string;
  due_at: string;
  subtitle: string | null;
  status: string | null;
  action: string | null;
  priority: string | null;
};

export function useJobs(status?: JobStatus) {
  return useQuery({
    queryKey: ["jobs", status ?? "all"],
    queryFn: async () => (await api.get<Job[]>("/jobs", { params: status ? { status } : undefined })).data
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) =>
      (await api.patch<Job>(`/jobs/${id}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useNotes(query?: string, tags?: string) {
  return useQuery({
    queryKey: ["notes", query ?? "", tags ?? ""],
    queryFn: async () => (await api.get<Note[]>("/notes", { params: { q: query || undefined, tags } })).data
  });
}

export function useEvents(source?: string) {
  return useQuery({
    queryKey: ["events", source ?? "all"],
    queryFn: async () => (await api.get<{ items: Event[] }>("/events", { params: source ? { source } : undefined })).data.items
  });
}

export function useToday() {
  return useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: async () => (await api.get<{ items: DashboardItem[] }>("/dashboard/today")).data
  });
}
