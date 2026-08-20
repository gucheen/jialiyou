"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type View = "today" | "items" | "shopping" | "spaces";
type ItemState = "充足" | "不多了" | "快用完" | "已用完";
type InventoryItem = { id: number; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null; updatedAt: string };
type ShoppingItem = { id: number; name: string; quantity: string; checked: number | boolean };
type HomeData = { items: InventoryItem[]; shopping: ShoppingItem[] };

const stateOrder: ItemState[] = ["充足", "不多了", "快用完", "已用完"];
const viewNames: Record<View, string> = { today: "今天", items: "全部物品", shopping: "购物清单", spaces: "空间" };
const viewIcons: Record<View, string> = { today: "⌂", items: "▦", shopping: "✓", spaces: "⌑" };

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

export default function InventoryApp() {
  const [data, setData] = useState<HomeData>({ items: [], shopping: [] });
  const [view, setView] = useState<View>("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [modal, setModal] = useState<"item" | "shopping" | "audit" | null>(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/home", { cache: "no-store" });
      const payload = await response.json() as HomeData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "加载失败");
      setData(payload);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mutate = async (method: "POST" | "PATCH" | "DELETE", body: unknown, success: string) => {
    const response = await fetch("/api/home", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || "操作失败");
    await loadData();
    setToast(success);
  };

  const openItems = (needsAttention = false) => {
    setView("items");
    setAttentionOnly(needsAttention);
    setQuery("");
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
    return matches && (!attentionOnly || attentionItems.some((entry) => entry.id === item.id));
  }), [data.items, query, attentionOnly, attentionItems]);
  const activeShopping = data.shopping.filter((item) => !Boolean(item.checked));
  const spaces = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    data.items.forEach((item) => {
      const room = item.location.split("·")[0].trim();
      groups.set(room, [...(groups.get(room) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [data.items]);

  const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("today")}><span className="brand-mark">有</span><span>家里有</span></button>
        <nav className="nav-list" aria-label="主要导航">
          {(Object.keys(viewNames) as View[]).map((key) => (
            <button className={`nav-item ${view === key ? "active" : ""}`} onClick={() => setView(key)} key={key} aria-current={view === key ? "page" : undefined}>
              <span>{viewIcons[key]}</span>{viewNames[key]}{key === "shopping" && activeShopping.length > 0 ? <b>{activeShopping.length}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><div className="family-avatars"><span>陈</span><span>林</span><i>＋</i></div><p>我们的家</p><small>2 位成员 · 数据已同步</small></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{today}</p><h1>{view === "today" ? "早上好，今天家里还好吗？" : viewNames[view]}</h1></div>
          <div className="top-actions">
            <button className="search-button" aria-label="搜索物品" onClick={() => openItems(false)}>⌕</button>
            <button className="add-button" onClick={() => setModal("item")}>＋ <span>记一件</span></button>
          </div>
        </header>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={loadData} /> : (
          <>
            {view === "today" && <TodayView items={attentionItems} shopping={activeShopping} openItems={openItems} setModal={setModal} changeState={changeState} toggleShopping={toggleShopping} />}
            {view === "items" && <ItemsView items={filteredItems} query={query} setQuery={setQuery} attentionOnly={attentionOnly} setAttentionOnly={setAttentionOnly} changeState={changeState} remove={async (item) => { if (window.confirm(`确定移除“${item.name}”吗？`)) await mutate("DELETE", { type: "item", id: item.id }, "已从家里移除"); }} />}
            {view === "shopping" && <ShoppingView items={data.shopping} toggle={toggleShopping} add={() => setModal("shopping")} remove={(item) => mutate("DELETE", { type: "shopping", id: item.id }, "已移除清单项")} />}
            {view === "spaces" && <SpacesView spaces={spaces} openItems={(room) => { setView("items"); setQuery(room); setAttentionOnly(false); }} />}
          </>
        )}
      </section>

      {modal === "item" && <ItemModal close={() => setModal(null)} save={async (body) => { await mutate("POST", body, "已经记下来了"); setModal(null); }} />}
      {modal === "shopping" && <ShoppingModal close={() => setModal(null)} save={async (body) => { await mutate("POST", body, "已加入购物清单"); setModal(null); }} />}
      {modal === "audit" && <AuditModal items={data.items.slice(0, 6)} close={() => setModal(null)} changeState={changeState} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
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

function ItemsView({ items, query, setQuery, attentionOnly, setAttentionOnly, changeState, remove }: { items: InventoryItem[]; query: string; setQuery: (value: string) => void; attentionOnly: boolean; setAttentionOnly: (value: boolean) => void; changeState: (item: InventoryItem, state?: ItemState) => void; remove: (item: InventoryItem) => void }) {
  return <section className="full-panel">
    <div className="list-tools"><label className="search-field"><span>⌕</span><input autoFocus placeholder="搜索名称、位置或状态" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className={`filter-button ${attentionOnly ? "selected" : ""}`} onClick={() => setAttentionOnly(!attentionOnly)}>只看需留意</button></div>
    <div className="table-head"><span>物品</span><span>位置</span><span>状态</span><span></span></div>
    <div className="full-list">{items.map((item) => <ItemRow item={item} key={item.id} changeState={changeState} remove={remove} expanded />)}{!items.length && <EmptyMini text="没有找到符合条件的物品" />}</div>
  </section>;
}

function ItemRow({ item, changeState, remove, expanded = false }: { item: InventoryItem; changeState: (item: InventoryItem, state?: ItemState) => void; remove?: (item: InventoryItem) => void; expanded?: boolean }) {
  const expiry = expiryText(item.expiresOn);
  return <article className={`item-row ${expanded ? "expanded" : ""}`}>
    <div className="item-icon">{item.icon}</div><div className="item-copy"><h4>{item.name}</h4>{!expanded && <p>{item.location}</p>}</div>
    {expanded && <p className="location-cell">{item.location}</p>}
    <button className={`status ${statusTone(item)}`} onClick={() => changeState(item)} title="点击切换库存状态">{expiry && (daysUntil(item.expiresOn) ?? 999) <= 30 ? expiry : item.state}</button>
    {remove ? <button className="delete-button" onClick={() => remove(item)} aria-label={`移除${item.name}`}>×</button> : <button className="more" onClick={() => changeState(item)} aria-label={`${item.name}切换状态`}>•••</button>}
  </article>;
}

function ShoppingView({ items, toggle, add, remove }: { items: ShoppingItem[]; toggle: (item: ShoppingItem) => void; add: () => void; remove: (item: ShoppingItem) => void }) {
  const remaining = items.filter((item) => !Boolean(item.checked)).length;
  return <section className="shopping-page"><div className="shopping-summary"><div><strong>{remaining}</strong><span>件还没买</span></div><button onClick={add}>＋ 添加一项</button></div><div className="shopping-list-large">{items.map((item) => <article key={item.id} className={Boolean(item.checked) ? "done" : ""}><button className="check-large" onClick={() => toggle(item)} aria-label={Boolean(item.checked) ? "恢复" : "完成"}>{Boolean(item.checked) ? "✓" : ""}</button><div><h3>{item.name}</h3><p>{item.quantity}</p></div><button className="remove-shopping" onClick={() => remove(item)} aria-label={`移除${item.name}`}>×</button></article>)}</div></section>;
}

function SpacesView({ spaces, openItems }: { spaces: [string, InventoryItem[]][]; openItems: (room: string) => void }) {
  const icons: Record<string, string> = { 厨房: "♨", 客厅: "⌂", 储藏室: "▤", 阳台: "☀", 书房: "✎", 卫生间: "◌" };
  return <section className="spaces-grid">{spaces.map(([room, items]) => <button className="space-card" onClick={() => openItems(room)} key={room}><span className="space-icon">{icons[room] ?? "⌑"}</span><div><h2>{room}</h2><p>{items.length} 件物品</p></div><span className="space-arrow">→</span></button>)}</section>;
}

function ItemModal({ close, save }: { close: () => void; save: (body: ItemInputPayload) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [icon, setIcon] = useState("📦");
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget); try { await save({ type: "item", name: String(form.get("name")), icon, location: String(form.get("location")), state: String(form.get("state")) as ItemState, expiresOn: String(form.get("expiresOn")) || null }); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存失败"); setSaving(false); } };
  return <Modal title="记一件家里的东西" subtitle="只填名称和位置也完全可以" close={close}><form onSubmit={submit} className="modal-form"><label>物品名称<input name="name" required autoFocus placeholder="例如：黑胡椒" /></label><fieldset><legend>选择一个图标</legend><div className="icon-choices">{["📦","🥛","🥫","🧴","💊","🔋","🧻","🧸"].map((value) => <button type="button" className={icon === value ? "selected" : ""} onClick={() => setIcon(value)} key={value}>{value}</button>)}</div></fieldset><label>放在哪里<input name="location" required placeholder="例如：厨房 · 吊柜" /></label><div className="form-row"><label>现在有多少<select name="state" defaultValue="充足">{stateOrder.map((state) => <option key={state}>{state}</option>)}</select></label><label>到期日（可不填）<input type="date" name="expiresOn" /></label></div>{message && <p className="form-error">{message}</p>}<button className="primary-submit" disabled={saving}>{saving ? "正在记下…" : "记好了"}</button></form></Modal>;
}
type ItemInputPayload = { type: "item"; name: string; icon: string; location: string; state: ItemState; expiresOn: string | null };

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
