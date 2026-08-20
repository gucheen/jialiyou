import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemState = "充足" | "不多了" | "快用完" | "已用完";
type InventoryItem = { id: number; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null; updatedAt: string };
type ShoppingItem = { id: number; name: string; quantity: string; checked: boolean };
type Store = { items: InventoryItem[]; shopping: ShoppingItem[] };

const dataDir = path.join(process.cwd(), "data");
const dataPath = path.join(dataDir, "home.json");
const validStates = new Set<ItemState>(["充足", "不多了", "快用完", "已用完"]);

async function readStore(): Promise<Store> {
  const contents = await readFile(dataPath, "utf8");
  return JSON.parse(contents) as Store;
}

async function writeStore(store: Store) {
  await mkdir(dataDir, { recursive: true });
  const temporaryPath = path.join(dataDir, `home.${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporaryPath, dataPath);
}

function nextId(records: Array<{ id: number }>) {
  return records.reduce((highest, record) => Math.max(highest, record.id), 0) + 1;
}

export async function GET() {
  try {
    return NextResponse.json(await readStore());
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "暂时无法读取家庭物资" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const store = await readStore();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "请填写名称" }, { status: 400 });

    if (body.type === "item") {
      const location = String(body.location ?? "").trim();
      if (!location) return NextResponse.json({ error: "请填写存放位置" }, { status: 400 });
      const requestedState = String(body.state ?? "充足") as ItemState;
      store.items.unshift({
        id: nextId(store.items),
        name,
        icon: String(body.icon ?? "📦").trim() || "📦",
        location,
        state: validStates.has(requestedState) ? requestedState : "充足",
        expiresOn: body.expiresOn ? String(body.expiresOn) : null,
        updatedAt: new Date().toISOString(),
      });
    } else if (body.type === "shopping") {
      store.shopping.unshift({ id: nextId(store.shopping), name, quantity: String(body.quantity ?? "1件").trim() || "1件", checked: false });
    } else {
      return NextResponse.json({ error: "无法识别的记录类型" }, { status: 400 });
    }
    await writeStore(store);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const store = await readStore();
    if (!Number.isInteger(id)) return NextResponse.json({ error: "无效的记录" }, { status: 400 });

    if (body.type === "item") {
      const state = String(body.state ?? "") as ItemState;
      if (!validStates.has(state)) return NextResponse.json({ error: "无效的状态" }, { status: 400 });
      const item = store.items.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这件物品" }, { status: 404 });
      item.state = state;
      item.updatedAt = new Date().toISOString();
    } else if (body.type === "shopping") {
      const item = store.shopping.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这条清单" }, { status: 404 });
      item.checked = Boolean(body.checked);
    } else {
      return NextResponse.json({ error: "无效的修改" }, { status: 400 });
    }
    await writeStore(store);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const store = await readStore();
    if (!Number.isInteger(id)) return NextResponse.json({ error: "无效的记录" }, { status: 400 });
    if (body.type === "item") store.items = store.items.filter((entry) => entry.id !== id);
    else if (body.type === "shopping") store.shopping = store.shopping.filter((entry) => entry.id !== id);
    else return NextResponse.json({ error: "无效的记录类型" }, { status: 400 });
    await writeStore(store);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  }
}
