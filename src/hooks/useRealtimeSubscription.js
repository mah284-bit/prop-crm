/**
 * useRealtimeSubscription — Supabase Realtime subscription hook
 *
 * Subscribes to postgres_changes events for a table.
 * Calls provided callbacks when INSERT/UPDATE/DELETE events occur.
 *
 * Day 12 Sunday (24 May 2026) - Phase 2.0 - Subtask 1.4
 * Author: PropCRM team (Day 12 dev2 sprint)
 *
 * USAGE:
 *   import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
 *
 *   useRealtimeSubscription({
 *     table: 'proposals',
 *     filter: `opportunity_id=eq.${oppId}`,
 *     onInsert: (row) => setProposals(p => [row, ...p]),
 *     onUpdate: (row) => setProposals(p => p.map(x => x.id === row.id ? row : x)),
 *     onDelete: (oldRow) => setProposals(p => p.filter(x => x.id !== oldRow.id)),
 *   });
 *
 * NOTES:
 *   - The hook handles channel cleanup automatically (returns cleanup on unmount).
 *   - Filter syntax: `column=eq.value` or `column=in.(val1,val2)` (Supabase Realtime filter format).
 *   - Each subscription uses a unique channel name based on table + filter.
 *   - Set debug: true to see console logs (useful during development).
 *
 * COMMON FILTERS:
 *   - All rows: omit filter
 *   - Specific opp: filter: `opportunity_id=eq.${oppId}`
 *   - Specific company: filter: `company_id=eq.${companyId}`
 *   - Multiple IDs: filter: `id=in.(uuid1,uuid2,uuid3)`
 */

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSubscription({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  debug = false,
}) {
  useEffect(() => {
    if (!table) {
      if (debug) console.warn('[useRealtimeSubscription] No table specified - skipping subscription');
      return;
    }

    // Unique channel name to avoid conflicts when subscribing to same table in multiple components
    const channelName = `realtime:${table}:${filter || 'all'}:${Math.random().toString(36).slice(2, 8)}`;

    if (debug) {
      console.log(`[useRealtimeSubscription] Subscribing to ${table}${filter ? ` (filter: ${filter})` : ''}`);
    }

    // Build subscription config
    const config = { event: '*', schema: 'public', table };
    if (filter) config.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', config, (payload) => {
        if (debug) {
          console.log(`[useRealtimeSubscription] ${table} ${payload.eventType}:`, payload);
        }

        if (payload.eventType === 'INSERT' && onInsert) {
          onInsert(payload.new);
        } else if (payload.eventType === 'UPDATE' && onUpdate) {
          onUpdate(payload.new);
        } else if (payload.eventType === 'DELETE' && onDelete) {
          // payload.old contains the deleted row's id + columns marked for replica identity
          onDelete(payload.old);
        }
      })
      .subscribe((status) => {
        if (debug) {
          console.log(`[useRealtimeSubscription] ${table} status:`, status);
        }
      });

    // Cleanup on unmount
    return () => {
      if (debug) {
        console.log(`[useRealtimeSubscription] Unsubscribing from ${table}`);
      }
      supabase.removeChannel(channel);
    };
    // We intentionally only depend on table + filter strings.
    // Callbacks may be inline functions, so depending on them would cause endless re-subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
