import { create } from "zustand";

export const useSchedulerStore = create((set) => ({
  scheduledTasks: [],
  setScheduledTasks: (scheduledTasks) => set({ scheduledTasks }),
  upsertScheduledTask: (task) =>
    set((state) => ({
      scheduledTasks: state.scheduledTasks.some((t) => t.id === task.id)
        ? state.scheduledTasks.map((t) => (t.id === task.id ? task : t))
        : [...state.scheduledTasks, task],
    })),
}));
