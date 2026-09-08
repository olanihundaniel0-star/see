import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type JobStatus = "bookmarked" | "applied" | "interviewing" | "offer" | "rejected";
export type ReminderPriority = "low" | "medium" | "high";
const PAGE_SIZE = 20;

export type JobChecklist = {
  id: string;
  title: string;
  is_completed: boolean;
};

export type Job = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  location: string | null;
  salary_range: string | null;
  job_url: string | null;
  status: JobStatus;
  interview_notes: string | null;
  deadline: string | null;
  applied_at: string;
  updated_at: string;
  checklists: JobChecklist[];
};

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
};

export type Reminder = {
  id: string;
  user_id: string;
  title: string;
  due_date: string;
  priority: ReminderPriority;
  is_completed: boolean;
  created_at: string;
};

export type Event = {
  id: string;
  source: string;
  external_id: string;
  title: string;
  description: string | null;
  url: string;
  source_url: string | null;
  location: string | null;
  is_virtual: boolean;
  categories: string[] | null;
  prize_pool: string | null;
  start_date: string;
  end_date: string | null;
  last_seen_at: string;
  raw_source_ref: string | null;
  scraped_at: string;
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

export type DashboardResponse = {
  generated_at: string;
  window_hours: number;
  reminder_count: number;
  job_count: number;
  items: DashboardItem[];
};

type PageResponse<T> = {
  page: number;
  page_size: number;
  items: T[];
};

function getNextPageParam<T extends { length: number }>(lastPage: T, pages: T[]) {
  return lastPage.length === PAGE_SIZE ? pages.length + 1 : undefined;
}

export function useToday() {
  return useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: async () => (await api.get<DashboardResponse>("/dashboard/today")).data
  });
}

export function useJobs(status?: JobStatus) {
  return useQuery({
    queryKey: ["jobs", status ?? "all"],
    queryFn: async () =>
      (
        await api.get<Job[]>("/jobs", {
          params: {
            status,
            page_size: 50
          }
        })
      ).data
  });
}

export function useInfiniteJobs(status?: JobStatus) {
  return useInfiniteQuery({
    queryKey: ["jobs", status ?? "all", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<Job[]>("/jobs", {
          params: {
            status,
            page: pageParam,
            page_size: PAGE_SIZE
          }
        })
      ).data,
    getNextPageParam
  });
}

export function useJob(jobId?: string) {
  return useQuery({
    queryKey: ["jobs", jobId],
    enabled: Boolean(jobId),
    queryFn: async () => (await api.get<Job>(`/jobs/${jobId}`)).data
  });
}

export function useJobChecklists(jobId?: string) {
  return useQuery({
    queryKey: ["jobs", jobId, "checklists"],
    enabled: Boolean(jobId),
    queryFn: async () => (await api.get<JobChecklist[]>(`/jobs/${jobId}/checklists`)).data
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => (await api.patch<Job>(`/jobs/${id}`, data)).data,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["jobs", variables.id] });
      await queryClient.invalidateQueries({ queryKey: ["jobs", variables.id, "checklists"] });
    }
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useToggleChecklist(jobId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ checklistId, isCompleted }: { checklistId: string; isCompleted: boolean }) => {
      if (!jobId) {
        throw new Error("Missing job id.");
      }

      return (
        await api.patch<JobChecklist>(`/jobs/${jobId}/checklists/${checklistId}`, {
          is_completed: isCompleted
        })
      ).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs", jobId] });
    }
  });
}

export function useCreateChecklist(jobId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      if (!jobId) {
        throw new Error("Missing job id.");
      }

      return (
        await api.post<JobChecklist>(`/jobs/${jobId}/checklists`, {
          title,
          is_completed: false
        })
      ).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs", jobId] });
    }
  });
}

export function useNotes(query?: string, tags?: string) {
  return useQuery({
    queryKey: ["notes", query ?? "", tags ?? ""],
    queryFn: async () =>
      (
        await api.get<Note[]>("/notes", {
          params: { q: query || undefined, tags, page_size: 50 }
        })
      ).data
  });
}

export function useInfiniteNotes(query?: string, tags?: string) {
  return useInfiniteQuery({
    queryKey: ["notes", query ?? "", tags ?? "", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<Note[]>("/notes", {
          params: { q: query || undefined, tags, page: pageParam, page_size: PAGE_SIZE }
        })
      ).data,
    getNextPageParam
  });
}

export function useNote(noteId?: string) {
  return useQuery({
    queryKey: ["notes", noteId],
    enabled: Boolean(noteId),
    queryFn: async () => (await api.get<Note>(`/notes/${noteId}`)).data
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Pick<Note, "title" | "content" | "tags">) => (await api.post<Note>("/notes", data)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Note, "title" | "content" | "tags">> }) =>
      (await api.patch<Note>(`/notes/${id}`, data)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notes/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
  });
}

export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async () => (await api.get<Reminder[]>("/reminders", { params: { page_size: 50 } })).data
  });
}

export function useInfiniteReminders() {
  return useInfiniteQuery({
    queryKey: ["reminders", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<Reminder[]>("/reminders", {
          params: { page: pageParam, page_size: PAGE_SIZE }
        })
      ).data,
    getNextPageParam
  });
}

export function useReminder(reminderId?: string) {
  return useQuery({
    queryKey: ["reminders", reminderId],
    enabled: Boolean(reminderId),
    queryFn: async () => (await api.get<Reminder>(`/reminders/${reminderId}`)).data
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Reminder, "title" | "due_date" | "priority" | "is_completed">> }) =>
      (await api.patch<Reminder>(`/reminders/${id}`, data)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reminders/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}

export function useEvents(isVirtual?: boolean) {
  return useQuery({
    queryKey: ["events", isVirtual === undefined ? "all" : isVirtual ? "virtual" : "in-person"],
    queryFn: async () =>
      (
        await api.get<PageResponse<Event>>("/events", {
          params: {
            is_virtual: isVirtual,
            page_size: 50
          }
        })
      ).data.items
  });
}

export function useInfiniteEvents(isVirtual?: boolean) {
  return useInfiniteQuery({
    queryKey: ["events", isVirtual === undefined ? "all" : isVirtual ? "virtual" : "in-person", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<PageResponse<Event>>("/events", {
          params: {
            is_virtual: isVirtual,
            page: pageParam,
            page_size: PAGE_SIZE
          }
        })
      ).data,
    getNextPageParam: (lastPage, pages) => (lastPage.items.length === lastPage.page_size ? pages.length + 1 : undefined)
  });
}

export function useQuickAdd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "job" | "note" | "reminder";
      title?: string | null;
      data: Record<string, unknown>;
    }) => (await api.post<{ id: string; type: string }>("/quick-add", payload)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.invalidateQueries({ queryKey: ["reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
}
