import { useMutation } from '@tanstack/react-query';
import { applySchedule, runScheduler } from '../engine/index.js';

export function useAutoScheduleRun() {
  const run = useMutation({ mutationFn: runScheduler });
  const apply = useMutation({ mutationFn: applySchedule });
  return { run, apply };
}
