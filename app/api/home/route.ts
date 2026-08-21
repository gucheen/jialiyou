import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemState = "充足" | "不多了" | "快用完" | "已用完";
type InventoryItem = { id: number; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null; updatedAt: string };
type ShoppingItem = { id: number; name: string; quantity: string; checked: boolean };
type Movement = { id: number; itemId: number; itemName: string; fromLocation: string; toLocation: string; movedAt: string; movedBy: string; undoneAt?: string };
type Store = { items: InventoryItem[]; shopping: ShoppingItem[]; movements: Movement[] };

const dataDir = path.join(process.cwd(), "data");
const dataPath = path.join(dataDir, "home.json");
const exampleDataPath = path.join(dataDir, "home.example.json");
const validStates = new Set<ItemState>(["充足", "不多了", "快用完", "已用完"]);

async function readStore(): Promise<Store> {
  let contents: string;
  try {
    contents = await readFile(dataPath, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    const initialContents = await readFile(exampleDataPath, "utf8");
    await mkdir(dataDir, { recursive: true });
    try {
      await writeFile(dataPath, initialContents, { encoding: "utf8", flag: "wx" });
    } catch (writeError) {
      if (!(writeError instanceof Error && "code" in writeError && writeError.code === "EEXIST")) throw writeError;
    }
    contents = await readFile(dataPath, "utf8");
  }
  const store = JSON.parse(contents) as Omit<Store, "movements"> & { movements?: Movement[] };
  return { ...store, movements: Array.isArray(store.movements) ? store.movements : [] };
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
  if (!(await getCurrentUser())) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    return NextResponse.json(await readStore());
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "暂时无法读取家庭物资" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "请先登录" }, { status: 401 });
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const store = await readStore();
    if (!Number.isInteger(id)) return NextResponse.json({ error: "无效的记录" }, { status: 400 });

    let movement: Movement | undefined;
    if (body.type === "item") {
      const state = String(body.state ?? "") as ItemState;
      if (!validStates.has(state)) return NextResponse.json({ error: "无效的状态" }, { status: 400 });
      const item = store.items.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这件物品" }, { status: 404 });
      item.state = state;
      item.updatedAt = new Date().toISOString();
    } else if (body.type === "item-details") {
      const item = store.items.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这件物品" }, { status: 404 });
      const name = String(body.name ?? "").trim();
      const location = String(body.location ?? "").trim();
      const state = String(body.state ?? "") as ItemState;
      const expiresOn = body.expiresOn ? String(body.expiresOn) : null;
      if (!name) return NextResponse.json({ error: "请填写名称" }, { status: 400 });
      if (name.length > 100) return NextResponse.json({ error: "物品名称不能超过 100 个字" }, { status: 400 });
      if (!location) return NextResponse.json({ error: "请填写存放位置" }, { status: 400 });
      if (location.length > 100) return NextResponse.json({ error: "位置名称不能超过 100 个字" }, { status: 400 });
      if (!validStates.has(state)) return NextResponse.json({ error: "无效的状态" }, { status: 400 });
      if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return NextResponse.json({ error: "无效的到期日" }, { status: 400 });
      const updatedAt = new Date().toISOString();
      if (location !== item.location) {
        movement = { id: nextId(store.movements), itemId: item.id, itemName: name, fromLocation: item.location, toLocation: location, movedAt: updatedAt, movedBy: currentUser };
        store.movements.unshift(movement);
      }
      item.name = name;
      item.icon = String(body.icon ?? "📦").trim() || "📦";
      item.location = location;
      item.state = state;
      item.expiresOn = expiresOn;
      item.updatedAt = updatedAt;
    } else if (body.type === "shopping") {
      const item = store.shopping.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这条清单" }, { status: 404 });
      item.checked = Boolean(body.checked);
    } else if (body.type === "movement") {
      const item = store.items.find((entry) => entry.id === id);
      if (!item) return NextResponse.json({ error: "没有找到这件物品" }, { status: 404 });
      const toLocation = String(body.toLocation ?? "").trim();
      if (!toLocation) return NextResponse.json({ error: "请选择要移动到的位置" }, { status: 400 });
      if (toLocation.length > 100) return NextResponse.json({ error: "位置名称不能超过 100 个字" }, { status: 400 });
      if (toLocation === item.location) return NextResponse.json({ error: "物品已经在这个位置" }, { status: 400 });
      const movedAt = new Date().toISOString();
      movement = { id: nextId(store.movements), itemId: item.id, itemName: item.name, fromLocation: item.location, toLocation, movedAt, movedBy: currentUser };
      item.location = toLocation;
      item.updatedAt = movedAt;
      store.movements.unshift(movement);
    } else if (body.type === "undo-movement") {
      movement = store.movements.find((entry) => entry.id === id);
      if (!movement || movement.undoneAt) return NextResponse.json({ error: "这次移动已无法撤销" }, { status: 409 });
      const item = store.items.find((entry) => entry.id === movement?.itemId);
      if (!item || item.location !== movement.toLocation) return NextResponse.json({ error: "物品位置后来又发生了变化，无法撤销" }, { status: 409 });
      const undoneAt = new Date().toISOString();
      item.location = movement.fromLocation;
      item.updatedAt = undoneAt;
      movement.undoneAt = undoneAt;
    } else {
      return NextResponse.json({ error: "无效的修改" }, { status: 400 });
    }
    await writeStore(store);
    return NextResponse.json({ ok: true, movement });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "请先登录" }, { status: 401 });
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
