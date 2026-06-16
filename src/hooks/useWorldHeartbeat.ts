import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { WORLD_HEARTBEAT_INTERVAL } from '../../convex/constants';

type HeartbeatWorldStatus =
  | {
      worldId: Id<'worlds'>;
      lastViewed: number;
    }
  | null
  | undefined;

export function useWorldHeartbeat(sharedWorldStatus?: HeartbeatWorldStatus) {
  const queriedWorldStatus = useQuery(
    api.world.defaultWorldStatus,
    sharedWorldStatus === undefined ? undefined : 'skip',
  );
  const worldStatus = sharedWorldStatus === undefined ? queriedWorldStatus : sharedWorldStatus;
  const worldId = worldStatus?.worldId;
  const worldStatusRef = useRef<HeartbeatWorldStatus>(worldStatus);
  useEffect(() => {
    worldStatusRef.current = worldStatus;
  }, [worldStatus]);

  // Send a periodic heartbeat to our world to keep it alive.
  const heartbeat = useMutation(api.world.heartbeatWorld);
  useEffect(() => {
    const sendHeartBeat = () => {
      const currentWorldStatus = worldStatusRef.current;
      if (!currentWorldStatus) {
        return;
      }
      // Don't send a heartbeat if we've observed one sufficiently close
      // to the present.
      if (Date.now() - WORLD_HEARTBEAT_INTERVAL / 2 < currentWorldStatus.lastViewed) {
        return;
      }
      void heartbeat({ worldId: currentWorldStatus.worldId });
    };
    sendHeartBeat();
    const id = setInterval(sendHeartBeat, WORLD_HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
    // Rerun if the `worldId` changes but not every `worldStatus` tick. The
    // latest status is read from a ref so lastViewed changes do not recreate
    // the interval or cause duplicate heartbeats.
  }, [worldId, heartbeat]);
}
