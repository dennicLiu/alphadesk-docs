/* AlphaDesk 文档站交互: 导航高亮 / FAQ / 灯箱 */
(function () {
  // 导航高亮
  const links = Array.from(document.querySelectorAll(".nav a"));
  const secs = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const onScroll = () => {
    let cur = null;
    for (const s of secs) {
      if (s.getBoundingClientRect().top <= 90) cur = s;
    }
    links.forEach((a) =>
      a.classList.toggle("active", cur && a.getAttribute("href") === "#" + cur.id));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // FAQ 折叠
  document.querySelectorAll(".faq").forEach((f) =>
    f.addEventListener("click", () => f.classList.toggle("open")));

  // 截图灯箱
  const box = document.getElementById("lightbox");
  const img = box.querySelector("img");
  document.querySelectorAll(".shot").forEach((s) =>
    s.addEventListener("click", () => { img.src = s.src; box.classList.add("open"); }));
  box.addEventListener("click", () => box.classList.remove("open"));

  // 微信购买弹窗: 点按钮出微信, 点微信号复制
  const modal = document.getElementById("wxmodal");
  const planEl = document.getElementById("wxmodalPlan");
  const numEl = document.getElementById("wxmodalNum");
  const okEl = document.getElementById("wxmodalOk");
  const WXNUM = "964468802";
  if (modal) {
    document.querySelectorAll(".wx-buy").forEach((b) =>
      b.addEventListener("click", () => {
        planEl.textContent = b.getAttribute("data-plan") || "AlphaDesk";
        okEl.textContent = "点微信号可一键复制";
        modal.classList.add("open");
      }));
    document.getElementById("wxmodalX")
      .addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") modal.classList.remove("open");
    });
    numEl.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(WXNUM);
        okEl.textContent = "✓ 已复制微信号，去微信粘贴添加好友吧";
      } catch (e) {
        const r = document.createRange();
        r.selectNodeContents(numEl);
        const sel = getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        okEl.textContent = "已选中，长按复制微信号";
      }
    });
  }
})();
