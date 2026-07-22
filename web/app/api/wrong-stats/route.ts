import { NextResponse } from "next/server";
import { aggregateWrongStats } from "@/lib/wrongStats.server";

export const revalidate = 300; // 5분

/** 클라이언트(퀴즈 hard 모드)용 오답률 집계. 익명 집계만 노출. */
export async function GET() {
  return NextResponse.json(await aggregateWrongStats());
}
