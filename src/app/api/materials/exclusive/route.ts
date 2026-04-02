import { NextResponse } from "next/server";
import { EXCLUSIVE_MATERIALS, getExclusiveMaterials } from "@/lib/exclusive-materials";

export const dynamic = "force-static";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type && type !== "web" && type !== "pdf") {
    return NextResponse.json(
      { error: "Invalid type. Expected 'web' or 'pdf'." },
      { status: 400 },
    );
  }

  const materials = getExclusiveMaterials(type);

  return NextResponse.json({
    success: true,
    data: {
      items: materials,
      groups: EXCLUSIVE_MATERIALS,
      total: materials.length,
      counts: {
        web: EXCLUSIVE_MATERIALS.web.length,
        pdf: EXCLUSIVE_MATERIALS.pdf.length,
      },
    },
  });
}
