import type { NextRequest } from "next/server";
import { reorderAdminRows } from "@/lib/admin-reorder";
export const dynamic = "force-dynamic";
export async function PUT(req: NextRequest) { return reorderAdminRows(req, "channels"); }
