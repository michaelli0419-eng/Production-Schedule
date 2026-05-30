import { useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase.js';
import { useRealtimeStore } from '../store/realtimeStore.js';

export function useRealtime({ table, filter, event = '*', onData, enabled = true }) {
  const setChannelStatus = useRealtimeStore((s) => s.setChannelStatus);
  const channelNameRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseEnabled || !enabled || !table) return;

    const channelName = filter
      ? `${table}:${filter}`
      : `${table}:${event}:${Date.now()}`;
    channelNameRef.current = channelName;

    let channel = supabase.channel(channelName);

    const postgresConfig = { event, schema: 'public', table };
    if (filter) postgresConfig.filter = filter;

    channel = channel.on('postgres_changes', postgresConfig, (payload) => {
      if (onData) onData(payload);
    });

    channel.subscribe((status) => {
      setChannelStatus(channelName, status === 'SUBSCRIBED' ? 'connected' : status);
    });

    return () => {
      if (channelNameRef.current) {
        setChannelStatus(channelNameRef.current, 'disconnected');
      }
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled]);
}
