"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

export type View = "today" | "items" | "shopping" | "spaces";
type ItemState = "充足" | "不多了" | "快用完" | "已用完";
type InventoryItem = { id: number; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null; updatedAt: string };
type ShoppingItem = { id: number; name: string; quantity: string; checked: number | boolean };
type Movement = { id: number; itemId: number; itemName: string; fromLocation: string; toLocation: string; movedAt: string; movedBy: string; undoneAt?: string };
type HomeData = { items: InventoryItem[]; shopping: ShoppingItem[]; movements: Movement[] };

const stateOrder: ItemState[] = ["充足", "不多了", "快用完", "已用完"];
const itemIconOptions = [
  { value: "📦", label: "其他" },
  { value: "🥫", label: "食品" },
  { value: "🥛", label: "饮品" },
  { value: "💊", label: "药品" },
  { value: "🧴", label: "清洁" },
  { value: "🪥", label: "个护" },
  { value: "🧻", label: "纸品" },
  { value: "👕", label: "衣物" },
  { value: "🍽️", label: "厨具" },
  { value: "🔧", label: "工具" },
  { value: "🔌", label: "电器" },
  { value: "🔋", label: "电池" },
  { value: "✏️", label: "文具" },
  { value: "🧸", label: "玩具" },
  { value: "🐾", label: "宠物" },
  { value: "🪴", label: "园艺" },
] as const;
const viewNames: Record<View, string> = { today: "今天", items: "全部物品", shopping: "购物清单", spaces: "空间" };
const viewIcons: Record<View, string> = { today: "⌂", items: "▦", shopping: "✓", spaces: "⌑" };
const viewPaths: Record<View, string> = { today: "/today", items: "/items", shopping: "/shopping", spaces: "/spaces" };

function itemsPath(query = "", attentionOnly = false, space = "") {
  const params = new URLSearchParams();
  if (space) params.set("space", space);
  else if (query) params.set("q", query);
  if (attentionOnly) params.set("attention", "1");
  const search = params.toString();
  return search ? `${viewPaths.items}?${search}` : viewPaths.items;
}

function spaceName(location: string) {
  return location.split("·")[0].trim();
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function expiryText(date: string | null) {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  if (days <= 30) return `${days}天后到期`;
  const parsed = new Date(`${date}T00:00:00`);
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日到期`;
}

function statusTone(item: InventoryItem) {
  const days = daysUntil(item.expiresOn);
  if (days !== null && days <= 30) return days <= 7 ? "red" : "amber";
  if (item.state === "充足") return "green";
  if (item.state === "不多了") return "amber";
  return "orange";
}

export default function InventoryApp({ username, view, initialQuery = "", initialAttentionOnly = false, initialSpace = "" }: { username: string; view: View; initialQuery?: string; initialAttentionOnly?: boolean; initialSpace?: string }) {
  const router = useRouter();
  const [data, setData] = useState<HomeData>({ items: [], shopping: [], movements: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(initialQuery);
  const [attentionOnly, setAttentionOnly] = useState(initialAttentionOnly);
  const [selectedSpace, setSelectedSpace] = useState(initialSpace);
  const [modal, setModal] = useState<"item" | "shopping" | "audit" | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState("");
  const [undoMovement, setUndoMovement] = useState<Movement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/home", { cache: "no-store" });
      if (response.status === 401) { window.location.replace("/login"); return; }
      const payload = await response.json() as HomeData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "加载失败");
      setData({ ...payload, movements: payload.movements ?? [] });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    setQuery(initialQuery);
    setAttentionOnly(initialAttentionOnly);
    setSelectedSpace(initialSpace);
  }, [initialQuery, initialAttentionOnly, initialSpace]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => { setToast(""); setUndoMovement(null); }, undoMovement ? 5000 : 2200);
    return () => window.clearTimeout(timer);
  }, [toast, undoMovement]);

  const mutate = async (method: "POST" | "PATCH" | "DELETE", body: unknown, success: string) => {
    const response = await fetch("/api/home", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.status === 401) { window.location.replace("/login"); throw new Error("登录已过期"); }
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "操作失败");
    await loadData();
    setUndoMovement(null);
    setToast(success);
  };

  const moveItem = async (item: InventoryItem, toLocation: string) => {
    const response = await fetch("/api/home", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "movement", id: item.id, toLocation }) });
    if (response.status === 401) { window.location.replace("/login"); throw new Error("登录已过期"); }
    const payload = await response.json() as { error?: string; movement?: Movement };
    if (!response.ok || !payload.movement) throw new Error(payload.error || "移动失败");
    await loadData();
    setMovingItem(null);
    setUndoMovement(payload.movement);
    setToast(`“${item.name}”已移动到 ${payload.movement.toLocation}`);
  };

  const undoMove = async () => {
    if (!undoMovement) return;
    const movement = undoMovement;
    setUndoMovement(null);
    try {
      const response = await fetch("/api/home", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "undo-movement", id: movement.id }) });
      if (response.status === 401) { window.location.replace("/login"); return; }
      const payload = await response.json() as { error?: string };
      if (!response.ok) { setToast(payload.error || "撤销失败"); return; }
      await loadData();
      setToast(`已放回 ${movement.fromLocation}`);
    } catch {
      setToast("撤销失败，请稍后重试");
    }
  };

  const openItems = (needsAttention = false) => {
    setAttentionOnly(needsAttention);
    setQuery("");
    setSelectedSpace("");
    router.push(itemsPath("", needsAttention));
  };

  const replaceItemsPath = (nextQuery: string, nextAttentionOnly: boolean, nextSpace = selectedSpace) => {
    window.history.replaceState(null, "", itemsPath(nextQuery, nextAttentionOnly, nextSpace));
  };

  const changeQuery = (value: string) => {
    const nextSpace = value === selectedSpace ? selectedSpace : "";
    setQuery(value);
    setSelectedSpace(nextSpace);
    replaceItemsPath(value, attentionOnly, nextSpace);
  };

  const toggleAttentionOnly = () => {
    const next = !attentionOnly;
    setAttentionOnly(next);
    replaceItemsPath(query, next, selectedSpace);
  };

  const changeState = async (item: InventoryItem, state?: ItemState) => {
    const next = state ?? stateOrder[(stateOrder.indexOf(item.state) + 1) % stateOrder.length];
    setData((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, state: next } : entry) }));
    try { await mutate("PATCH", { type: "item", id: item.id, state: next }, `“${item.name}”已标记为${next}`); }
    catch (cause) { setToast(cause instanceof Error ? cause.message : "修改失败"); await loadData(); }
  };

  const toggleShopping = async (item: ShoppingItem) => {
    const checked = !Boolean(item.checked);
    setData((current) => ({ ...current, shopping: current.shopping.map((entry) => entry.id === item.id ? { ...entry, checked } : entry) }));
    try { await mutate("PATCH", { type: "shopping", id: item.id, checked }, checked ? "已放进购物篮" : "已恢复到清单"); }
    catch (cause) { setToast(cause instanceof Error ? cause.message : "修改失败"); await loadData(); }
  };

  const attentionItems = useMemo(() => data.items.filter((item) => item.state !== "充足" || (daysUntil(item.expiresOn) ?? 999) <= 30), [data.items]);
  const filteredItems = useMemo(() => data.items.filter((item) => {
    const matches = `${item.name}${item.location}${item.state}`.toLowerCase().includes(query.toLowerCase());
    const matchesSpace = !selectedSpace || spaceName(item.location) === selectedSpace;
    return matches && matchesSpace && (!attentionOnly || attentionItems.some((entry) => entry.id === item.id));
  }), [data.items, query, selectedSpace, attentionOnly, attentionItems]);
  const activeShopping = data.shopping.filter((item) => !Boolean(item.checked));
  const spaces = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    data.items.forEach((item) => {
      const room = spaceName(item.location);
      groups.set(room, [...(groups.get(room) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [data.items]);
  const allLocations = useMemo(() => Array.from(new Set(data.items.map((item) => item.location))).sort((a, b) => a.localeCompare(b, "zh-CN")), [data.items]);
  const recentLocations = useMemo(() => Array.from(new Set(data.movements.filter((movement) => !movement.undoneAt).map((movement) => movement.toLocation))), [data.movements]);

  const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={viewPaths.today}><span className="brand-mark">有</span><span>家里有</span></Link>
        <nav className="nav-list" aria-label="主要导航">
          {(Object.keys(viewNames) as View[]).map((key) => (
            <Link className={`nav-item ${view === key ? "active" : ""}`} href={viewPaths[key]} key={key} aria-current={view === key ? "page" : undefined}>
              <span>{viewIcons[key]}</span>{viewNames[key]}{key === "shopping" && activeShopping.length > 0 ? <b>{activeShopping.length}</b> : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="family-avatars"><span>{username.slice(0, 1).toUpperCase()}</span></div><p>{username}</p><small>已安全登录</small><form action="/api/auth/logout" method="post"><button className="logout-button">退出登录</button></form></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{today}</p><h1>{view === "today" ? "早上好，今天家里还好吗？" : viewNames[view]}</h1></div>
          <div className="top-actions">
            <form className="mobile-logout" action="/api/auth/logout" method="post"><button aria-label="退出登录" title="退出登录">↪</button></form>
            <button className="search-button" aria-label="搜索物品" onClick={() => openItems(false)}>⌕</button>
            <button className="add-button" onClick={() => setModal("item")}>＋ <span>记一件</span></button>
          </div>
        </header>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={loadData} /> : (
          <>
            {view === "today" && <TodayView items={attentionItems} shopping={activeShopping} openItems={openItems} setModal={setModal} changeState={changeState} toggleShopping={toggleShopping} />}
            {view === "items" && <ItemsView items={filteredItems} movements={data.movements} query={query} setQuery={changeQuery} attentionOnly={attentionOnly} toggleAttentionOnly={toggleAttentionOnly} changeState={changeState} edit={setEditingItem} move={setMovingItem} remove={async (item) => { if (window.confirm(`确定移除“${item.name}”吗？`)) await mutate("DELETE", { type: "item", id: item.id }, "已从家里移除"); }} />}
            {view === "shopping" && <ShoppingView items={data.shopping} toggle={toggleShopping} add={() => setModal("shopping")} remove={(item) => mutate("DELETE", { type: "shopping", id: item.id }, "已移除清单项")} />}
            {view === "spaces" && <SpacesView spaces={spaces} openItems={(room) => { setQuery(room); setAttentionOnly(false); setSelectedSpace(room); router.push(itemsPath(room, false, room)); }} />}
          </>
        )}
      </section>

      {modal === "item" && <ItemModal close={() => setModal(null)} save={async (body) => { await mutate("POST", body, "已经记下来了"); setModal(null); }} />}
      {modal === "shopping" && <ShoppingModal close={() => setModal(null)} save={async (body) => { await mutate("POST", body, "已加入购物清单"); setModal(null); }} />}
      {modal === "audit" && <AuditModal items={data.items.slice(0, 6)} close={() => setModal(null)} changeState={changeState} />}
      {editingItem && <ItemModal item={editingItem} close={() => setEditingItem(null)} save={async (body) => { await mutate("PATCH", { ...body, type: "item-details", id: editingItem.id }, `“${body.name.trim()}”已更新`); setEditingItem(null); }} />}
      {movingItem && <MoveModal item={movingItem} recentLocations={recentLocations} allLocations={allLocations} close={() => setMovingItem(null)} move={moveItem} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}{undoMovement && <button onClick={() => void undoMove()}>撤销</button>}</div>}
    </main>
  );
}

function TodayView({ items, shopping, openItems, setModal, changeState, toggleShopping }: { items: InventoryItem[]; shopping: ShoppingItem[]; openItems: (value?: boolean) => void; setModal: (value: "item" | "shopping" | "audit") => void; changeState: (item: InventoryItem) => void; toggleShopping: (item: ShoppingItem) => void }) {
  const expiring = items.filter((item) => (daysUntil(item.expiresOn) ?? 999) <= 7);
  return <>
    <section className="focus-card">
      <div className="focus-copy"><span className="focus-label">今天值得留意</span><h2>别让好东西悄悄过期</h2><p>{expiring.length ? `有 ${expiring.length} 件物品建议这周优先使用，顺手看看就好。` : "这周没有即将过期的物品，家里状态很不错。"}</p><button onClick={() => openItems(true)}>去看看 <span>→</span></button></div>
      <div className="focus-visual" aria-hidden="true"><div className="sun"></div><div className="bottle">MILK</div><div className="leaf">⌁</div></div>
    </section>
    <div className="section-title"><div><h2>家里近况</h2><p>只看真正需要你注意的事</p></div><button onClick={() => setModal("audit")}>快速盘点</button></div>
    <section className="overview-grid">
      <div className="inventory-panel">
        <div className="panel-heading"><h3>需要留意</h3><button onClick={() => openItems(true)}>查看全部 {items.length} 件</button></div>
        <div className="item-list">{items.slice(0, 4).map((item) => <ItemRow item={item} key={item.id} changeState={changeState} />)}{!items.length && <EmptyMini text="目前没有需要留意的物品" />}</div>
      </div>
      <aside className="shopping-panel">
        <div className="shopping-head"><span>购物清单</span><strong>{shopping.length}</strong></div><p>下次出门别忘了</p>
        {shopping.slice(0, 4).map((item) => <label key={item.id}><input type="checkbox" checked={Boolean(item.checked)} onChange={() => toggleShopping(item)} /><span>{item.name}</span><small>× {item.quantity}</small></label>)}
        {!shopping.length && <div className="shopping-empty">暂时没有要买的东西</div>}
        <button onClick={() => setModal("shopping")}>＋ 添加一项</button>
      </aside>
    </section>
  </>;
}

function ItemsView({ items, movements, query, setQuery, attentionOnly, toggleAttentionOnly, changeState, edit, move, remove }: { items: InventoryItem[]; movements: Movement[]; query: string; setQuery: (value: string) => void; attentionOnly: boolean; toggleAttentionOnly: () => void; changeState: (item: InventoryItem, state?: ItemState) => void; edit: (item: InventoryItem) => void; move: (item: InventoryItem) => void; remove: (item: InventoryItem) => void }) {
  return <>
  <section className="full-panel">
    <div className="list-tools"><label className="search-field"><span>⌕</span><input autoFocus placeholder="搜索名称、位置或状态" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className={`filter-button ${attentionOnly ? "selected" : ""}`} onClick={toggleAttentionOnly}>只看需留意</button></div>
    <div className="table-head"><span>物品</span><span>位置</span><span>状态</span><span></span></div>
    <div className="full-list">{items.map((item) => <ItemRow item={item} key={item.id} changeState={changeState} edit={edit} move={move} remove={remove} expanded />)}{!items.length && <EmptyMini text="没有找到符合条件的物品" />}</div>
  </section>
  <MovementHistory movements={movements} />
  </>;
}

function ItemRow({ item, changeState, edit, move, remove, expanded = false }: { item: InventoryItem; changeState: (item: InventoryItem, state?: ItemState) => void; edit?: (item: InventoryItem) => void; move?: (item: InventoryItem) => void; remove?: (item: InventoryItem) => void; expanded?: boolean }) {
  const expiry = expiryText(item.expiresOn);
  return <article className={`item-row ${expanded ? "expanded" : ""}`}>
    <div className="item-icon">{item.icon}</div><div className="item-copy"><h4>{item.name}</h4>{!expanded && <p>{item.location}</p>}</div>
    {expanded && <p className="location-cell">{item.location}</p>}
    <button className={`status ${statusTone(item)}`} onClick={() => changeState(item)} title="点击切换库存状态">{expiry && (daysUntil(item.expiresOn) ?? 999) <= 30 ? expiry : item.state}</button>
    {remove && move && edit ? <div className="item-actions"><button className="edit-button" onClick={() => edit(item)}>编辑</button><button className="move-button" onClick={() => move(item)}>移动</button><button className="delete-button" onClick={() => remove(item)} aria-label={`移除${item.name}`}>×</button></div> : <button className="more" onClick={() => changeState(item)} aria-label={`${item.name}切换状态`}>•••</button>}
  </article>;
}

function MovementHistory({ movements }: { movements: Movement[] }) {
  if (!movements.length) return null;
  return <details className="movement-history"><summary>最近移动记录 <span>{movements.length}</span></summary><div>{movements.slice(0, 8).map((movement) => <article className={movement.undoneAt ? "undone" : ""} key={movement.id}><span className="movement-dot">→</span><div><strong>{movement.itemName}</strong><p>{movement.fromLocation} <b>→</b> {movement.toLocation}</p></div><small>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(movement.movedAt))}{movement.undoneAt ? " · 已撤销" : ""}</small></article>)}</div></details>;
}

function ShoppingView({ items, toggle, add, remove }: { items: ShoppingItem[]; toggle: (item: ShoppingItem) => void; add: () => void; remove: (item: ShoppingItem) => void }) {
  const remaining = items.filter((item) => !Boolean(item.checked)).length;
  return <section className="shopping-page"><div className="shopping-summary"><div><strong>{remaining}</strong><span>件还没买</span></div><button onClick={add}>＋ 添加一项</button></div><div className="shopping-list-large">{items.map((item) => <article key={item.id} className={Boolean(item.checked) ? "done" : ""}><button className="check-large" onClick={() => toggle(item)} aria-label={Boolean(item.checked) ? "恢复" : "完成"}>{Boolean(item.checked) ? "✓" : ""}</button><div><h3>{item.name}</h3><p>{item.quantity}</p></div><button className="remove-shopping" onClick={() => remove(item)} aria-label={`移除${item.name}`}>×</button></article>)}</div></section>;
}

function SpacesView({ spaces, openItems }: { spaces: [string, InventoryItem[]][]; openItems: (room: string) => void }) {
  const icons: Record<string, string> = { 厨房: "♨", 客厅: "⌂", 储藏室: "▤", 阳台: "☀", 书房: "✎", 卫生间: "◌" };
  return <section className="spaces-grid">{spaces.map(([room, items]) => <button className="space-card" onClick={() => openItems(room)} key={room}><span className="space-icon">{icons[room] ?? "⌑"}</span><div><h2>{room}</h2><p>{items.length} 件物品</p></div><span className="space-arrow">→</span></button>)}</section>;
}

function ItemModal({ item, close, save }: { item?: InventoryItem; close: () => void; save: (body: ItemInputPayload) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [icon, setIcon] = useState(item?.icon ?? "📦");
  const iconOptions = item && !itemIconOptions.some((option) => option.value === item.icon)
    ? [{ value: item.icon, label: "当前" }, ...itemIconOptions]
    : itemIconOptions;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget); try { await save({ type: "item", name: String(form.get("name")), icon, location: String(form.get("location")), state: String(form.get("state")) as ItemState, expiresOn: String(form.get("expiresOn")) || null }); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存失败"); setSaving(false); } };
  return <Modal title={item ? `编辑“${item.name}”` : "记一件家里的东西"} subtitle={item ? "修改后会保留原来的物品记录" : "只填名称和位置也完全可以"} close={close}><form onSubmit={submit} className="modal-form"><label>物品名称<input name="name" required autoFocus defaultValue={item?.name} maxLength={100} placeholder="例如：黑胡椒" /></label><fieldset><legend>物品分类</legend><div className="icon-choices">{iconOptions.map((option) => <button type="button" className={icon === option.value ? "selected" : ""} onClick={() => setIcon(option.value)} aria-pressed={icon === option.value} key={option.value}><span>{option.value}</span><small>{option.label}</small></button>)}</div></fieldset><label>放在哪里<input name="location" required defaultValue={item?.location} maxLength={100} placeholder="例如：厨房 · 吊柜" /></label><div className="form-row"><label>现在有多少<select name="state" defaultValue={item?.state ?? "充足"}>{stateOrder.map((state) => <option key={state}>{state}</option>)}</select></label><label>到期日（可不填）<input type="date" name="expiresOn" defaultValue={item?.expiresOn ?? ""} /></label></div>{message && <p className="form-error">{message}</p>}<button className="primary-submit" disabled={saving}>{saving ? "正在保存…" : item ? "保存修改" : "记好了"}</button></form></Modal>;
}
type ItemInputPayload = { type: "item"; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null };

function MoveModal({ item, recentLocations, allLocations, close, move }: { item: InventoryItem; recentLocations: string[]; allLocations: string[]; close: () => void; move: (item: InventoryItem, toLocation: string) => Promise<void> }) {
  const suggestions = Array.from(new Set([...recentLocations, ...allLocations])).filter((location) => location !== item.location);
  const [location, setLocation] = useState(suggestions[0] ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setMessage(""); try { await move(item, location.trim()); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "移动失败"); setSaving(false); } };
  return <Modal title={`移动“${item.name}”`} subtitle={`现在放在 ${item.location}`} close={close}><form className="modal-form move-form" onSubmit={submit}>{suggestions.length > 0 && <fieldset><legend>最近和常用位置</legend><div className="location-choices">{suggestions.slice(0, 4).map((value) => <button type="button" className={location === value ? "selected" : ""} onClick={() => setLocation(value)} key={value}>{value}</button>)}</div></fieldset>}<label>移动到<input required autoFocus={!suggestions.length} list="known-locations" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：客厅 · 边柜" /><datalist id="known-locations">{allLocations.filter((value) => value !== item.location).map((value) => <option value={value} key={value} />)}</datalist></label>{message && <p className="form-error">{message}</p>}<button className="primary-submit" disabled={saving || !location.trim()}>{saving ? "正在移动…" : "确认移动"}</button></form></Modal>;
}

function ShoppingModal({ close, save }: { close: () => void; save: (body: { type: "shopping"; name: string; quantity: string }) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); try { await save({ type: "shopping", name: String(form.get("name")), quantity: String(form.get("quantity")) }); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存失败"); setSaving(false); } };
  return <Modal title="加入购物清单" subtitle="买到后勾一下就好" close={close}><form onSubmit={submit} className="modal-form"><label>要买什么<input name="name" required autoFocus placeholder="例如：燕麦奶" /></label><label>大概买多少<input name="quantity" defaultValue="1件" placeholder="例如：2盒" /></label>{message && <p className="form-error">{message}</p>}<button className="primary-submit" disabled={saving}>{saving ? "正在添加…" : "加入清单"}</button></form></Modal>;
}

function AuditModal({ items, close, changeState }: { items: InventoryItem[]; close: () => void; changeState: (item: InventoryItem, state?: ItemState) => void }) {
  return <Modal title="两分钟快速盘点" subtitle="看到什么就点一下，不用追求完全准确" close={close}><div className="audit-list">{items.map((item) => <div key={item.id}><span className="audit-icon">{item.icon}</span><strong>{item.name}</strong><div>{stateOrder.slice(0, 3).map((state) => <button className={item.state === state ? "selected" : ""} onClick={() => changeState(item, state)} key={state}>{state}</button>)}</div></div>)}</div><button className="primary-submit" onClick={close}>盘点完成</button></Modal>;
}

function Modal({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={close} aria-label="关闭">×</button><h2 id="modal-title">{title}</h2><p>{subtitle}</p>{children}</section></div>;
}
function LoadingState() { return <div className="loading-state"><span></span><p>正在看看家里的近况…</p></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="error-state"><strong>暂时没能打开家里的清单</strong><p>{message}</p><button onClick={retry}>再试一次</button></div>; }
function EmptyMini({ text }: { text: string }) { return <div className="empty-mini"><span>✓</span><p>{text}</p></div>; }
