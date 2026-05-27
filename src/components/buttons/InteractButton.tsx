import { toast } from 'react-toastify';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
// import { SignInButton } from '@clerk/clerk-react';
import { useServerGame } from '../../hooks/serverGame';

export default function InteractButton({ className = '' }: { className?: string }) {
  // const { isAuthenticated } = useConvexAuth();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(api.world.userStatus, worldId ? { worldId } : 'skip');
  const userPlayerId =
    game && [...game.world.players.values()].find((p) => p.human === humanTokenIdentifier)?.id;
  const enterCampus = useMutation(api.school.enterCampus);
  const leaveCampus = useMutation(api.school.leaveCampus);
  const isPlaying = !!userPlayerId;

  const joinOrLeaveGame = () => {
    if (
      !worldId ||
      // || !isAuthenticated
      game === undefined
    ) {
      return;
    }
    if (isPlaying) {
      console.log(`Leaving game for player ${userPlayerId}`);
      void leaveCampus({}).then((result) => toast.info(result.descriptionZh));
    } else {
      console.log(`Joining game`);
      void enterCampus({})
        .then((result) => toast.success(result.descriptionZh))
        .catch((error) => toast.error(error.message));
    }
  };
  // if (!isAuthenticated || game === undefined) {
  //   return (
  //     <SignInButton>
  //       <Button imgUrl={interactImg}>Interact</Button>
  //     </SignInButton>
  //   );
  // }
  return (
    <button
      className={`giis-presence-button ${isPlaying ? 'giis-presence-button-playing' : ''} ${className}`}
      onClick={joinOrLeaveGame}
      title={
        isPlaying
          ? '放開 Alan：他離開校園，世界繼續，但你不再以他的身分行動。'
          : '接手 Alan：他回到校園，你的點地形 / 說話會以 Alan 身分發生。'
      }
    >
      {isPlaying ? '放開 Alan' : '接手 Alan'}
    </button>
  );
}
