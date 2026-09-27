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
})();
