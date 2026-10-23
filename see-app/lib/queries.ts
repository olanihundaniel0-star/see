import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { syncLocalNotifications } from "@/lib/notifications";
import { Alert } from "react-native";
import { useContext } from "react";
import { AccountContext } from "@/lib/session";

import { api } from "@/lib/api";

export type JobStatus = "bookmarked" | "applied" | "assessment" | "interviewing" | "offer" | "rejected" | "archived";
export type ReminderPriority = "low" | "medium" | "high";
export type NoteSource = "manual" | "email" | "all";
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
  interview_at: string | null;
  assessment_at: string | null;
  follow_up_at: string | null;
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
  truncated: boolean;
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
    queryKey: [useContext(AccountContext), "dashboard", "today"],
    queryFn: async ({ signal }) => (await api.get<DashboardResponse>("/dashboard/today", { signal })).data
  });
}

export function useJobs(status?: JobStatus) {
  return useQuery({
    queryKey: [useContext(AccountContext), "jobs", status ?? "all"],
    queryFn: async ({ signal }) =>
      (
        await api.get<Job[]>("/jobs", {
          signal, params: {
            status,
            page_size: 50
          }
        })
      ).data
  });
}

export function useInfiniteJobs(status?: JobStatus) {
  return useInfiniteQuery({
    queryKey: [useContext(AccountContext), "jobs", status ?? "all", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<Job[]>("/jobs", {
          signal, params: {
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
    queryKey: [useContext(AccountContext), "jobs", jobId],
    enabled: Boolean(jobId),
    queryFn: async ({ signal }) => (await api.get<Job>(`/jobs/${jobId}`, { signal })).data
  });
}

export function useJobChecklists(jobId?: string) {
  return useQuery({
    queryKey: [useContext(AccountContext), "jobs", jobId, "checklists"],
    enabled: Boolean(jobId),
    queryFn: async ({ signal }) => (await api.get<JobChecklist[]>(`/jobs/${jobId}/checklists`, { signal })).data
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);

  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => (await api.patch<Job>(`/jobs/${id}`, data)).data,
    onSuccess: async () => {
      if (account) void syncLocalNotifications(account).catch(error => console.warn("Alert synchronization failed", error.message));
      await queryClient.invalidateQueries({ queryKey: [account, "jobs"] });
      await queryClient.invalidateQueries({ queryKey: [account, "dashboard"] });

    }
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);

  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: async () => {
      if (account) void syncLocalNotifications(account).catch(error => console.warn("Alert synchronization failed", error.message));
      await queryClient.invalidateQueries({ queryKey: [account, "jobs"] });
      await queryClient.invalidateQueries({ queryKey: [account, "dashboard"] });
    }
  });
}

export function useToggleChecklist(jobId?: string) {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);

  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
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
      await queryClient.invalidateQueries({ queryKey: [account, "jobs"] });

    }
  });
}

export function useCreateChecklist(jobId?: string) {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);

  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
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
      await queryClient.invalidateQueries({ queryKey: [account, "jobs"] });

    }
  });
}

export function useNotes(query?: string, tags?: string, source: NoteSource = "manual") {
  return useQuery({
    queryKey: [useContext(AccountContext), "notes", source, query ?? "", tags ?? ""],
    queryFn: async ({ signal }) =>
      (
        await api.get<Note[]>("/notes", {
          signal, params: { q: query || undefined, tags, source, page_size: 50 }
        })
      ).data
  });
}

export function useInfiniteNotes(query?: string, tags?: string, source: NoteSource = "manual") {
  return useInfiniteQuery({
    queryKey: [useContext(AccountContext), "notes", source, query ?? "", tags ?? "", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<Note[]>("/notes", {
          signal, params: { q: query || undefined, tags, source, page: pageParam, page_size: PAGE_SIZE }
        })
      ).data,
    getNextPageParam
  });
}

export function useNote(noteId?: string) {
  return useQuery({
    queryKey: [useContext(AccountContext), "notes", noteId],
    enabled: Boolean(noteId),
    queryFn: async ({ signal }) => (await api.get<Note>(`/notes/${noteId}`, { signal })).data
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async (data: Pick<Note, "title" | "content" | "tags">) => (await api.post<Note>("/notes", data)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [account, "notes"] });
    }
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Note, "title" | "content" | "tags">> }) =>
      (await api.patch<Note>(`/notes/${id}`, data)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [account, "notes"] });
    }
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async (id: string) => {
      await api.delete(`/notes/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [account, "notes"] });
    }
  });
}

export function useReminders() {
  return useQuery({
    queryKey: [useContext(AccountContext), "reminders"],
    queryFn: async ({ signal }) => (await api.get<Reminder[]>("/reminders", { signal, params: { page_size: 50 } })).data
  });
}

export function useInfiniteReminders() {
  return useInfiniteQuery({
    queryKey: [useContext(AccountContext), "reminders", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<Reminder[]>("/reminders", {
          signal, params: { page: pageParam, page_size: PAGE_SIZE }
        })
      ).data,
    getNextPageParam
  });
}

export function useReminder(reminderId?: string) {
  return useQuery({
    queryKey: [useContext(AccountContext), "reminders", reminderId],
    enabled: Boolean(reminderId),
    queryFn: async ({ signal }) => (await api.get<Reminder>(`/reminders/${reminderId}`, { signal })).data
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Reminder, "title" | "due_date" | "priority" | "is_completed">> }) =>
      (await api.patch<Reminder>(`/reminders/${id}`, data)).data,
    onSuccess: async () => {
      if (account) void syncLocalNotifications(account).catch(error => console.warn("Alert synchronization failed", error.message));
      await queryClient.invalidateQueries({ queryKey: [account, "reminders"] });
      await queryClient.invalidateQueries({ queryKey: [account, "dashboard"] });
    }
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async (id: string) => {
      await api.delete(`/reminders/${id}`);
    },
    onSuccess: async () => {
      if (account) void syncLocalNotifications(account).catch(error => console.warn("Alert synchronization failed", error.message));
      await queryClient.invalidateQueries({ queryKey: [account, "reminders"] });
      await queryClient.invalidateQueries({ queryKey: [account, "dashboard"] });
    }
  });
}

export function useEvents(isVirtual?: boolean) {
  return useQuery({
    queryKey: [useContext(AccountContext), "events", isVirtual === undefined ? "all" : isVirtual ? "virtual" : "in-person"],
    queryFn: async ({ signal }) =>
      (
        await api.get<PageResponse<Event>>("/events", {
          signal, params: {
            is_virtual: isVirtual,
            page_size: 50
          }
        })
      ).data.items
  });
}

export function useInfiniteEvents(isVirtual?: boolean) {
  return useInfiniteQuery({
    queryKey: [useContext(AccountContext), "events", isVirtual === undefined ? "all" : isVirtual ? "virtual" : "in-person", "infinite"],
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<PageResponse<Event>>("/events", {
          signal, params: {
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
  const account = useContext(AccountContext);
  return useMutation({
    onError: (error) => Alert.alert("Unable to save change", error.message),
    mutationFn: async (payload: {
      type: "job" | "note" | "reminder";
      title?: string | null;
      data: Record<string, unknown>;
    }) => (await api.post<{ id: string; type: string }>("/quick-add", payload)).data,
    onSuccess: (_, variables) => {
      const resource = { job: "jobs", note: "notes", reminder: "reminders" }[variables.type];
      if (variables.type !== "note" && account) {
        void syncLocalNotifications(account).catch(error => console.warn("Alert synchronization failed", error.message));
      }
      // The write already succeeded. A slow refresh must not keep the form in
      // "Saving…" or make the user submit the same item again.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: [account, resource] }),
        ...(variables.type === "note" ? [] : [queryClient.invalidateQueries({ queryKey: [account, "dashboard"] })])
      ]).catch(error => console.warn("Background refresh failed", error));
    }
  });
}
