// assets/js/app.js

(function () {
  const STORE_NAME = "فروشگاه ماکان";

  function toman(n) {
    const s = String(Math.max(0, Number(n || 0)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " تومان";
  }

  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) || "";
  }

  async function loadProducts() {
    const res = await fetch("assets/data/products.json", { cache: "no-store" });
    if (!res.ok) throw new Error("products.json not found");
    return await res.json();
  }

  function calcFinalPrice(p) {
    const price = Number(p.price_toman || 0);
    const off = Number(p.discount_percent || 0);
    if (!off) return { oldPrice: 0, newPrice: price };
    const newPrice = Math.round(price * (100 - off) / 100);
    return { oldPrice: price, newPrice };
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function safeText(s) {
    return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function normalizeImages(p) {
    // پشتیبانی از حالت‌های مختلف:
    // images: ["..."] یا images: "..." یا image: "..."
    const imgs = p && p.images;
    if (Array.isArray(imgs)) return imgs.map(String).filter(Boolean);
    if (typeof imgs === "string" && imgs.trim()) return [imgs.trim()];

    const single = p && p.image;
    if (typeof single === "string" && single.trim()) return [single.trim()];

    return [];
  }

  function firstImage(p) {
    const imgs = normalizeImages(p);
    return imgs.length ? imgs[0] : "";
  }

  function renderCategoryCard(cat) {
    return `
      <div class="card cat" data-cat="${encodeURIComponent(cat)}">
        <div class="cat__icon">#</div>
        <div class="cat__name">${safeText(cat)}</div>
      </div>
    `;
  }

  function renderProductCard(p) {
    const { oldPrice, newPrice } = calcFinalPrice(p);
    const off = Number(p.discount_percent || 0);
    const stock = !!p.in_stock;

    const badge = !stock
      ? `<span class="badge badge--out">ناموجود</span>`
      : off
        ? `<span class="badge badge--off">${off}% تخفیف</span>`
        : `<span class="badge">موجود</span>`;

    const priceHtml = off
      ? `<div class="price">
           <div class="price__old">${toman(oldPrice)}</div>
           <div class="price__new">${toman(newPrice)}</div>
         </div>`
      : `<div class="price">
           <div class="price__new">${toman(newPrice)}</div>
         </div>`;

    const img = firstImage(p);

    return `
      <a class="card product" href="product.html?slug=${encodeURIComponent(p.slug)}">
        <div class="product__img">
          ${img ? `<img src="${img}" alt="${safeText(p.title)}" loading="lazy" />` : `تصویر`}
        </div>
        <div class="product__title">${safeText(p.title)}</div>
        <div class="row">
          ${priceHtml}
          ${badge}
        </div>
      </a>
    `;
  }

  function wireSearch() {
    const q = document.getElementById("q");
    const btn = document.getElementById("btnSearch");
    if (!q || !btn) return;

    btn.addEventListener("click", () => {
      const term = (q.value || "").trim();
      if (!term) {
        window.location.href = "products.html";
        return;
      }
      window.location.href = `products.html?q=${encodeURIComponent(term)}`;
    });

    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btn.click();
    });
  }

  async function initHome() {
    document.title = STORE_NAME;
    wireSearch();

    const products = await loadProducts();
    const categories = uniq(products.map(p => p.category).filter(Boolean));

    const catsEl = document.getElementById("cats");
    if (catsEl) {
      catsEl.innerHTML = categories.map(renderCategoryCard).join("");
      catsEl.querySelectorAll(".cat").forEach(el => {
        el.addEventListener("click", () => {
          const cat = decodeURIComponent(el.getAttribute("data-cat") || "");
          window.location.href = `products.html?cat=${encodeURIComponent(cat)}`;
        });
      });
    }

    const deals = products
      .filter(p => Number(p.discount_percent || 0) > 0)
      .slice(0, 8);

    const dealEl = document.getElementById("dealList");
    if (dealEl) dealEl.innerHTML = deals.map(renderProductCard).join("");

    const newest = products.slice().reverse().slice(0, 8);
    const newEl = document.getElementById("newList");
    if (newEl) newEl.innerHTML = newest.map(renderProductCard).join("");
  }

  async function initProducts() {
    wireSearch();

    const products = await loadProducts();

    const qParam = getParam("q");
    const catParam = getParam("cat");
    const filterParam = getParam("filter");
    const sortParam = getParam("sort") || "new";

    const qInput = document.getElementById("q");
    if (qInput && qParam) qInput.value = qParam;

    const catSelect = document.getElementById("cat");
    const sortSelect = document.getElementById("sort");
    const onlyInStock = document.getElementById("onlyInStock");
    const onlyDiscount = document.getElementById("onlyDiscount");

    const categories = uniq(products.map(p => p.category).filter(Boolean));
    if (catSelect) {
      catSelect.innerHTML =
        `<option value="">همه دسته‌ها</option>` +
        categories.map(c => `<option value="${safeText(c)}">${safeText(c)}</option>`).join("");
      if (catParam) catSelect.value = catParam;
    }

    if (sortSelect) sortSelect.value = sortParam;
    if (onlyDiscount && filterParam === "discount") onlyDiscount.checked = true;

    function apply() {
      let list = products.slice();

      const term = (qInput ? qInput.value : qParam).trim().toLowerCase();
      const cat = catSelect ? catSelect.value : catParam;
      const sort = sortSelect ? sortSelect.value : sortParam;
      const inStock = !!(onlyInStock && onlyInStock.checked);
      const discount = !!(onlyDiscount && onlyDiscount.checked);

      if (term) {
        list = list.filter(p =>
          String(p.title || "").toLowerCase().includes(term) ||
          String(p.short_desc || "").toLowerCase().includes(term) ||
          String(p.category || "").toLowerCase().includes(term)
        );
      }

      if (cat) list = list.filter(p => p.category === cat);
      if (inStock) list = list.filter(p => !!p.in_stock);
      if (discount) list = list.filter(p => Number(p.discount_percent || 0) > 0);

      if (sort === "cheap") {
        list.sort((a, b) => calcFinalPrice(a).newPrice - calcFinalPrice(b).newPrice);
      } else if (sort === "expensive") {
        list.sort((a, b) => calcFinalPrice(b).newPrice - calcFinalPrice(a).newPrice);
      } else {
        list = list.slice().reverse();
      }

      const listEl = document.getElementById("list");
      if (listEl) listEl.innerHTML = list.map(renderProductCard).join("");

      const countEl = document.getElementById("count");
      if (countEl) countEl.textContent = `${list.length} محصول`;
    }

    [qInput, catSelect, sortSelect, onlyInStock, onlyDiscount].forEach(el => {
      if (!el) return;
      const ev = (el.tagName === "INPUT" && el.type === "search") ? "input" : "change";
      el.addEventListener(ev, apply);
    });

    apply();
  }

  async function initProduct() {
    const slug = getParam("slug");
    const products = await loadProducts();
    const p = products.find(x => String(x.slug) === String(slug));

    const host = document.getElementById("p");
    if (!host) return;

    if (!p) {
      host.innerHTML = `<div class="card" style="padding:12px">محصول یافت نشد.</div>`;
      return;
    }

    const { oldPrice, newPrice } = calcFinalPrice(p);
    const off = Number(p.discount_percent || 0);
    const stock = !!p.in_stock;

    document.title = `${p.title} | ${STORE_NAME}`;

    const imgs = normalizeImages(p);
    const mainImg = imgs.length ? imgs[0] : "";

    const thumbsHtml = imgs.length > 1
      ? `<div class="thumbs">
          ${imgs.map((src, idx) => `
            <button class="thumb ${idx === 0 ? "thumb--active" : ""}" type="button" data-src="${src}">
              <img src="${src}" alt="${safeText(p.title)} ${idx + 1}" loading="lazy" />
            </button>
          `).join("")}
        </div>`
      : ``;

    host.innerHTML = `
      <div class="gallery">
        <div class="gallery__main" id="mainImage">
          ${mainImg ? `<img src="${mainImg}" alt="${safeText(p.title)}" />` : `تصویر`}
        </div>
        ${thumbsHtml}
        <div class="divider"></div>
        <div class="muted">دسته: ${safeText(p.category || "-")}</div>
        <div class="muted">وضعیت: ${stock ? "موجود" : "ناموجود"}</div>
      </div>

      <div class="info">
        <h1>${safeText(p.title)}</h1>
        <p>${safeText(p.short_desc || "توضیحات محصول اینجا قرار می‌گیرد.")}</p>

        <div class="row">
          <div class="price">
            ${off ? `<div class="price__old">${toman(oldPrice)}</div>` : ``}
            <div class="price__new">${toman(newPrice)}</div>
          </div>
          ${!stock ? `<span class="badge badge--out">ناموجود</span>` : off ? `<span class="badge badge--off">${off}% تخفیف</span>` : `<span class="badge">موجود</span>`}
        </div>

        <div class="divider"></div>

        <div class="actions">
          <a class="btn btn--primary" href="products.html">بازگشت به محصولات</a>
          <a class="btn" href="https://wa.me/989000000000?text=${encodeURIComponent("سلام، برای خرید " + p.title + " راهنمایی می‌خواستم.")}" target="_blank" rel="noopener">سفارش در واتساپ</a>
          <a class="btn btn--ghost" href="https://t.me/yourid" target="_blank" rel="noopener">تلگرام</a>
        </div>
      </div>
    `;

    if (imgs.length > 1) {
      const main = document.getElementById("mainImage");
      host.querySelectorAll(".thumb").forEach(btn => {
        btn.addEventListener("click", () => {
          const src = btn.getAttribute("data-src") || "";
          if (!src || !main) return;
          main.innerHTML = `<img src="${src}" alt="${safeText(p.title)}" />`;
          host.querySelectorAll(".thumb").forEach(x => x.classList.remove("thumb--active"));
          btn.classList.add("thumb--active");
        });
      });
    }
  }

  window.App = { initHome, initProducts, initProduct };
})();