import { createFileRoute } from "@tanstack/react-router";
import { GameStage } from "@/components/game-stage";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="h-dvh w-full overflow-hidden bg-ink text-paper">
      <GameStage />
    </main>
  );
}
