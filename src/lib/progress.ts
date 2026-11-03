import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { CharId } from "@/game/types";

const PLAYABLE = [
  "kage",
  "karasu",
  "enma",
  "akatsuki",
  "akai",
  "yoru",
  "hana",
  "kabuto",
  "shiro",
  "ryu",
  "mizuchi",
  "akakage",
  "shizuka",
  "werewolf",
  "chimera",
  "hellwolf",
  "fieldoni",
  "titan",
] as const;

const saveSchema = z.object({
  fighterId: z.enum(PLAYABLE),
  maxLevel: z.number().int().min(1).max(12),
  currentLevel: z.number().int().min(1).max(12),
  wins: z.number().int().min(0).max(100000),
  losses: z.number().int().min(0).max(100000),
});

export type ProgressRow = {
  fighterId: CharId;
  maxLevel: number;
  currentLevel: number;
  wins: number;
  losses: number;
};

export const loadProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      fighter_id: string;
      max_level: number;
      current_level: number;
      wins: number;
      losses: number;
    }>`
      select fighter_id, max_level, current_level, wins, losses
      from player_saves
      where user_id = ${context.userId}
      limit 1
    `;
    const r = rows[0];
    if (!r) {
      return {
        fighterId: "kage" as CharId,
        maxLevel: 1,
        currentLevel: 1,
        wins: 0,
        losses: 0,
      } satisfies ProgressRow;
    }
    return {
      fighterId: r.fighter_id as CharId,
      maxLevel: Number(r.max_level),
      currentLevel: Number(r.current_level),
      wins: Number(r.wins),
      losses: Number(r.losses),
    } satisfies ProgressRow;
  });

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into player_saves (user_id, fighter_id, max_level, current_level, wins, losses, updated_at)
      values (
        ${context.userId},
        ${data.fighterId},
        ${data.maxLevel},
        ${data.currentLevel},
        ${data.wins},
        ${data.losses},
        now()
      )
      on conflict (user_id) do update set
        fighter_id = excluded.fighter_id,
        max_level = greatest(player_saves.max_level, excluded.max_level),
        current_level = excluded.current_level,
        wins = excluded.wins,
        losses = excluded.losses,
        updated_at = now()
    `;
    return { ok: true as const };
  });
