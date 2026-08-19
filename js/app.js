(function () {
    "use strict";

    /* ================= 基础工具 ================= */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));

    function uid() {
        return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function fmtTime(ts) {
        const d = new Date(ts);
        const p = (n) => String(n).padStart(2, "0");
        return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    function haversineKm(aLat, aLng, bLat, bLng) {
        const R = 6371;
        const dLat = ((bLat - aLat) * Math.PI) / 180;
        const dLng = ((bLng - aLng) * Math.PI) / 180;
        const s =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(s));
    }

    function etaMin(km) {
        return Math.max(2, Math.round(km / 38 * 60 + 2));
    }

    /* ================= 状态 ================= */
    const state = {
        userName: localStorage.getItem("ufx-userName") || "市民小王",
        selectedLocation: null,          // {lat, lng, address}
        myRequest: null,                 // 求助页发起的请求
        requests: [],                    // 活动请求
        picking: false,
        autoDemo: localStorage.getItem("ufx-autoDemo") !== "0",
        map: null,
        pin: null,
        userMarker: null,
        incidentMarkers: {},
        copMarkers: {},
        lines: {},
        cardFor: null
    };

    const busyCopIds = new Set();

    /* ================= 事件总线（本页 + 跨标签页同步） ================= */
    const bus = new EventTarget();
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("ufx-workbench-v1") : null;

    function emit(type, data) {
        bus.dispatchEvent(new CustomEvent(type, { detail: data }));
        if (channel) channel.postMessage({ type, data });
    }

    if (channel) {
        channel.onmessage = (e) => {
            bus.dispatchEvent(new CustomEvent(e.data.type, { detail: e.data.data }));
        };
    }

    /* ================= DOM 引用 ================= */
    const els = {
        statusLine: $("#statusLine"),
        copCount: $("#copCount"),
        userName: $("#userName"),
        selectedAddress: $("#selectedAddress"),
        sosBtn: $("#sosBtn"),
        timeline: $("#timeline"),
        acceptedCard: $("#acceptedCard"),
        requestList: $("#requestList"),
        autoDemo: $("#autoDemo"),
        mapCard: $("#mapCard"),
        mapCardTitle: $("#mapCardTitle"),
        mapCardBody: $("#mapCardBody"),
        mapCardActions: $("#mapCardActions"),
        toast: $("#toast")
    };

    /* ================= Toast ================= */
    let toastTimer = null;
    function toast(msg) {
        els.toast.textContent = msg;
        els.toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
    }

    /* ================= 图标 ================= */
    const copIcon = L.icon({
        iconUrl: "assets/cop.png",
        iconSize: [48, 23],
        iconAnchor: [24, 12]
    });
    const civilianIcon = L.icon({
        iconUrl: "assets/civilian.png",
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    /* ================= 地图 ================= */
    function initMap() {
        state.map = L.map("map", {
            zoomControl: true,
            attributionControl: true
        }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(state.map);

        state.map.on("click", (e) => {
            if (!state.picking) return;
            setSelectedLocation(e.latlng.lat, e.latlng.lng, null, true);
        });
    }

    function renderCopMarkers() {
        COPS.forEach((cop) => {
            if (state.copMarkers[cop.userId]) state.map.removeLayer(state.copMarkers[cop.userId]);
            const m = L.marker([cop.lat, cop.lng], { icon: copIcon, zIndexOffset: 500 })
                .addTo(state.map)
                .on("click", () => showCopCard(cop));
            state.copMarkers[cop.userId] = m;
        });
    }

    function renderIncidentMarkers() {
        Object.values(state.incidentMarkers).forEach((m) => state.map.removeLayer(m));
        state.incidentMarkers = {};

        state.requests.forEach((req) => {
            const m = L.marker([req.lat, req.lng], { icon: civilianIcon, zIndexOffset: 300 })
                .addTo(state.map)
                .on("click", () => showRequestCard(req));
            state.incidentMarkers[req.id] = m;
        });

        // 已处理的历史求助也显示在地图上（灰色圆点）
        INCIDENTS.filter((i) => i.status === "engaged").forEach((i) => {
            L.circleMarker([i.lat, i.lng], {
                radius: 6,
                color: "#94a3b8",
                fillColor: "#cbd5e1",
                fillOpacity: .75,
                weight: 1
            }).addTo(state.map).bindTooltip(`已完成 · ${i.address}`, { direction: "top" });
        });
    }

    function drawAssignment(req) {
        if (!req.copId) return;
        const cop = COPS.find((c) => c.userId === req.copId);
        if (!cop) return;
        if (state.lines[req.id]) state.map.removeLayer(state.lines[req.id]);
        state.lines[req.id] = L.polyline(
            [[cop.lat, cop.lng], [req.lat, req.lng]],
            { color: "#16a34a", weight: 3, dashArray: "6 6" }
        ).addTo(state.map);
    }

    function setSelectedLocation(lat, lng, address, flyTo) {
        state.selectedLocation = { lat, lng, address: address || `所选位置 (${lat.toFixed(5)}, ${lng.toFixed(5)})` };
        if (state.pin) state.map.removeLayer(state.pin);
        state.pin = L.marker([lat, lng]).addTo(state.map);
        els.selectedAddress.textContent = state.selectedLocation.address;
        els.sosBtn.disabled = false;
        if (flyTo) state.map.setView([lat, lng], 15);
    }

    /* ================= 位置 ================= */
    function useGeolocation() {
        if (!navigator.geolocation) {
            toast("当前浏览器不支持定位");
            return;
        }
        toast("正在获取定位…");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                reverseGeocode(latitude, longitude).then((addr) => {
                    setSelectedLocation(latitude, longitude, addr || "我的当前位置", true);
                    toast("已使用当前位置");
                });
            },
            () => {
                toast("定位失败，请在地图上选点");
                switchTab("tab-map");
                startPicking();
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    function reverseGeocode(lat, lng) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        return fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`,
            { signal: ctrl.signal }
        )
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                clearTimeout(timer);
                return j && (j.display_name || j.name) ? j.display_name : null;
            })
            .catch(() => {
                clearTimeout(timer);
                return null;
            });
    }

    function startPicking() {
        state.picking = true;
        toast("请在地图上点选求助位置");
        switchTab("tab-map");
        els.pickOnMap?.classList.add("active");
    }

    function stopPicking() {
        state.picking = false;
        els.pickOnMap?.classList.remove("active");
    }

    /* ================= 调度逻辑 ================= */
    function nearestCops(lat, lng, n) {
        return COPS
            .map((c) => ({ cop: c, km: haversineKm(lat, lng, c.lat, c.lng) }))
            .sort((a, b) => a.km - b.km)
            .slice(0, n || COPS.length);
    }

    function nearestFreeCops(lat, lng, n) {
        return nearestCops(lat, lng, COPS.length)
            .filter((x) => !busyCopIds.has(x.cop.userId))
            .slice(0, n || COPS.length);
    }

    function createRequest(lat, lng, address, civilianId, opts) {
        const req = {
            id: uid(),
            civilianId,
            lat,
            lng,
            address,
            time: Date.now(),
            status: "waiting",
            copId: null,
            notified: [],
            _timer: null,
            _auto: opts?.auto || false
        };
        state.requests.unshift(req);
        emit("request-created", req);

        // 1.2 秒后模拟“已通知附近警员”
        setTimeout(() => {
            if (!state.requests.some((r) => r.id === req.id) || req.copId) return;
            const near = nearestCops(req.lat, req.lng, 3).map((x) => x.cop);
            req.notified = near.map((c) => c.userId);
            req.status = "notified";
            emit("request-updated", req);
        }, 1200);

        // 6~11 秒内若无人工派单，最近警员自动接单（模拟真实响应）
        const delay = 6000 + Math.random() * 5000;
        req._timer = setTimeout(() => {
            if (req.status !== "notified" || req.copId) return;
            const free = nearestFreeCops(req.lat, req.lng, 1);
            if (free.length) acceptRequest(req.id, free[0].cop, true);
        }, delay);

        renderAll();
        return req;
    }

    function acceptRequest(requestId, cop, auto) {
        const req = state.requests.find((r) => r.id === requestId);
        if (!req || req.copId) return;

        clearTimeout(req._timer);
        req.copId = cop.userId;
        req.status = "accepted";
        req.cop = cop;
        busyCopIds.add(cop.userId);

        emit("request-accepted", { requestId, cop: { ...cop }, civilianId: req.civilianId });

        if (auto) {
            toast(`${cop.displayName} 自动接单，正在赶往现场`);
        } else {
            toast(`已派单给 ${cop.displayName}`);
        }
        renderAll();
    }

    function assignNearest(requestId) {
        const req = state.requests.find((r) => r.id === requestId);
        if (!req) return;
        const free = nearestFreeCops(req.lat, req.lng, 1);
        if (!free.length) {
            toast("暂无空闲警员");
            return;
        }
        acceptRequest(requestId, free[0].cop, false);
    }

    /* ================= 渲染 ================= */
    function renderAll() {
        renderStatus();
        renderCopMarkers();
        renderIncidentMarkers();
        renderDispatchList();
        renderTimeline();
        state.requests.forEach(drawAssignment);
    }

    function renderStatus() {
        const pending = state.requests.filter((r) => r.status === "waiting" || r.status === "notified").length;
        els.copCount.textContent = `${COPS.length} 名警员`;
        els.statusLine.textContent = `应急响应演示 · ${pending} 个待处理求助 · 实时模拟`;
    }

    function renderDispatchList() {
        const active = state.requests.filter((r) => r.status === "waiting" || r.status === "notified" || r.status === "accepted");
        if (!active.length) {
            els.requestList.innerHTML = `<div class="empty-tip">暂无待处理求助<br/>可点击上方「模拟一条求助」或到「求助」页发起</div>`;
            return;
        }
        els.requestList.innerHTML = active.map((req) => {
            const near = nearestCops(req.lat, req.lng, 1)[0];
            const badgeClass = req.status === "accepted" ? "accepted" : req.status === "notified" ? "notified" : "waiting";
            const badgeText = req.status === "accepted" ? "已接单" : req.status === "notified" ? "已通知警员" : "等待派单";
            const cop = req.copId ? COPS.find((c) => c.userId === req.copId) : null;

            let actions = "";
            if (req.status !== "accepted") {
                actions = `<div class="req-actions"><button class="btn accept" data-assign="${req.id}">🚓 派给最近警员</button></div>`;
            }

            let copLine = "";
            if (cop) {
                const km = haversineKm(cop.lat, cop.lng, req.lat, req.lng);
                copLine = `<div class="req-cop">🚓 ${cop.displayName} · 距离 ${km.toFixed(1)} km · 预计 ${etaMin(km)} 分钟到达</div>`;
            }

            return `
                <div class="request-card ${req.status === "accepted" ? "accepted" : ""}" data-req-id="${req.id}">
                    <div class="req-top">
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        <span class="req-time">${fmtTime(req.time)}</span>
                    </div>
                    <div class="req-addr">📍 ${req.address}</div>
                    <div class="req-meta">市民 ${req.civilianId} · 最近警员 ${near ? near.km.toFixed(1) : "-"} km</div>
                    ${copLine}
                    ${actions}
                </div>`;
        }).join("");
    }

    function renderTimeline() {
        const steps = $$(".timeline .step");
        steps.forEach((s) => s.classList.remove("done", "active"));

        const req = state.myRequest;
        if (!req) {
            els.timeline.classList.add("hidden");
            els.acceptedCard.classList.add("hidden");
            return;
        }
        els.timeline.classList.remove("hidden");

        const mark = (name, cls) => {
            const el = els.timeline.querySelector(`[data-step="${name}"]`);
            if (el) el.classList.add(cls);
        };
        mark("sent", "done");
        if (req.status === "notified") {
            mark("notified", "active");
            els.acceptedCard.classList.add("hidden");
        } else if (req.status === "accepted") {
            mark("notified", "done");
            mark("accepted", "active");
            renderAcceptedCard(req);
        } else {
            mark("sent", "active");
            els.acceptedCard.classList.add("hidden");
        }
    }

    function renderAcceptedCard(req) {
        const cop = req.cop || COPS.find((c) => c.userId === req.copId);
        if (!cop) return;
        const km = haversineKm(cop.lat, cop.lng, req.lat, req.lng);
        els.acceptedCard.innerHTML = `
            <strong>${cop.displayName} 已接单</strong>
            <div class="row"><span>联系电话</span><span>${cop.phone}</span></div>
            <div class="row"><span>出发位置</span><span>${cop.address}</span></div>
            <div class="row"><span>预计到达</span><span>${etaMin(km)} 分钟</span></div>
            <div class="row"><span>综合评分</span><span>${cop.ratings}</span></div>`;
        els.acceptedCard.classList.remove("hidden");
    }

    /* ================= 地图卡片 ================= */
    function showCopCard(cop) {
        state.cardFor = { kind: "cop", cop };
        els.mapCardTitle.textContent = `🚓 ${cop.displayName}`;
        els.mapCardBody.innerHTML = `
            当前位置：${cop.address}<br/>
            电话：${cop.phone} · 评分：${cop.ratings}`;
        els.mapCardActions.classList.add("hidden");
        els.mapCard.classList.remove("hidden");
    }

    function showRequestCard(req) {
        state.cardFor = { kind: "req", req };
        els.mapCardTitle.textContent = `🆘 ${req.address}`;
        els.mapCardBody.innerHTML = `市民 ${req.civilianId} · ${fmtTime(req.time)}`;
        const cop = req.copId ? COPS.find((c) => c.userId === req.copId) : null;
        if (cop) {
            els.mapCardBody.innerHTML += `<br/>🚓 ${cop.displayName} 已接单 · 预计 ${etaMin(haversineKm(cop.lat, cop.lng, req.lat, req.lng))} 分钟到达`;
        }
        if (req.status === "waiting" || req.status === "notified") {
            els.mapCardActions.innerHTML = `<button class="btn accept" data-assign="${req.id}">🚓 派给最近警员</button>`;
            els.mapCardActions.classList.remove("hidden");
        } else {
            els.mapCardActions.classList.add("hidden");
        }
        els.mapCard.classList.remove("hidden");
    }

    function hideCard() {
        els.mapCard.classList.add("hidden");
        state.cardFor = null;
    }

    /* ================= 标签页切换 ================= */
    function switchTab(id) {
        $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
        $$(".tab").forEach((t) => t.classList.toggle("active", t.id === id));
        stopPicking();
        hideCard();
        if (id === "tab-map") setTimeout(() => state.map && state.map.invalidateSize(), 50);
    }

    /* ================= 事件绑定 ================= */
    function bindEvents() {
        $$(".tab-btn").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

        els.userName.value = state.userName;
        els.userName.addEventListener("change", () => {
            state.userName = els.userName.value.trim() || "市民小王";
            localStorage.setItem("ufx-userName", state.userName);
        });

        $("#useGps").addEventListener("click", useGeolocation);
        els.pickOnMap = $("#pickOnMap");
        els.pickOnMap.addEventListener("click", () => {
            if (state.picking) { stopPicking(); return; }
            startPicking();
        });

        els.sosBtn.addEventListener("click", () => {
            if (!state.selectedLocation) return;
            const loc = state.selectedLocation;
            const req = createRequest(loc.lat, loc.lng, loc.address, state.userName);
            state.myRequest = req;
            els.sosBtn.disabled = true;
            els.sosBtn.textContent = "✅ 求助已发出";
            toast("求助已发出，正在通知附近警员…");
            renderTimeline();
            setTimeout(() => {
                els.sosBtn.textContent = "🆘 一键求助";
                els.sosBtn.disabled = !state.selectedLocation;
            }, 2000);
        });

        $("#simulateBtn").addEventListener("click", () => simulateIncoming());

        els.autoDemo.checked = state.autoDemo;
        els.autoDemo.addEventListener("change", () => {
            state.autoDemo = els.autoDemo.checked;
            localStorage.setItem("ufx-autoDemo", state.autoDemo ? "1" : "0");
        });

        els.requestList.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-assign]");
            if (btn) assignNearest(btn.dataset.assign);
        });

        els.mapCardActions.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-assign]");
            if (btn) assignNearest(btn.dataset.assign);
        });

        $("#mapCardClose").addEventListener("click", hideCard);

        bus.addEventListener("request-created", (e) => {
            const req = e.detail;
            if (!state.requests.some((r) => r.id === req.id)) state.requests.unshift(req);
            renderAll();
        });

        bus.addEventListener("request-updated", (e) => {
            const req = e.detail;
            const local = state.requests.find((r) => r.id === req.id);
            if (local) {
                local.status = req.status;
                local.notified = req.notified || local.notified;
            }
            renderAll();
        });

        bus.addEventListener("request-accepted", (e) => {
            const { requestId, cop } = e.detail;
            const req = state.requests.find((r) => r.id === requestId);
            if (!req || req.copId) return;
            req.copId = cop.userId;
            req.status = "accepted";
            req.cop = cop;
            busyCopIds.add(cop.userId);
            renderAll();
        });
    }

    /* ================= 演示来单 ================= */
    function simulateIncoming() {
        const place = DEMO_PLACES[Math.floor(Math.random() * DEMO_PLACES.length)];
        const jitter = 0.008;
        const lat = place.lat + (Math.random() - 0.5) * jitter;
        const lng = place.lng + (Math.random() - 0.5) * jitter;
        const civilian = `市民${1000 + Math.floor(Math.random() * 9000)}`;
        createRequest(lat, lng, place.address, civilian, { auto: true });
    }

    function startAutoDemo() {
        const tick = () => {
            if (!state.autoDemo) return;
            simulateIncoming();
        };
        const loop = () => {
            const delay = 12000 + Math.random() * 14000;
            setTimeout(() => {
                tick();
                loop();
            }, delay);
        };
        loop();
    }

    /* ================= 启动 ================= */
    function init() {
        if (typeof L === "undefined") {
            els.statusLine.textContent = "地图组件加载失败，请检查网络后刷新";
            return;
        }

        // 初始待办：来自历史数据中 waiting 的求助
        INCIDENTS.filter((i) => i.status === "waiting").forEach((i) => {
            state.requests.push({
                id: i.id,
                civilianId: i.civilianId,
                lat: i.lat,
                lng: i.lng,
                address: i.address,
                time: new Date(i.time).getTime(),
                status: "waiting",
                copId: null,
                notified: []
            });
        });

        initMap();
        bindEvents();
        renderAll();
        startAutoDemo();
    }

    document.addEventListener("DOMContentLoaded", init);
})();
