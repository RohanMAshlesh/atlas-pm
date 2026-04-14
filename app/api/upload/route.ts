import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const project_id = formData.get("project_id") as string;
    const type = (formData.get("type") as string) || "other";

    if (!file || !project_id) {
      return NextResponse.json({ error: "File and project_id required" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    let content = "";

    try {
      if (ext === "pdf") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        content = data.text;
      } else if (ext === "docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } else if (["txt", "md", "srt", "vtt", "csv"].includes(ext)) {
        content = buffer.toString("utf-8");
      } else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
        content = `[Image file: ${filename}]`;
      } else {
        content = buffer.toString("utf-8");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      content = `[Could not parse ${filename}]`;
    }

    const id = uuidv4();
    await db.insert(documents)
      .values({
        id,
        project_id,
        filename,
        type,
        content: content.slice(0, 500000),
        file_path: null,
        created_at: new Date().toISOString(),
      })
      .run();

    return NextResponse.json(
      {
        id,
        project_id,
        filename,
        type,
        content_preview: content.slice(0, 200),
        content_length: content.length,
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}
