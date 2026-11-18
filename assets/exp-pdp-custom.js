/**
 * EXP PDP Custom Script
 * Handles custom PDP interactions:
 * - Variant selection sync with color swatches & size cards
 * - Sticky Add to Cart bar triggers & desktop scroll observer
 * - 360° interactive viewer modal with drag rotation
 * - Mobile wishlist toggle with localStorage persistence
 * - Cross-sell item quick-add
 */

document.addEventListener('DOMContentLoaded', () => {
  initExpPdp();
});

function initExpPdp() {
  initStickyAtc();
  initColorSwatchesSync();
  initSizeCardsSync();
  init360Modal();
  initWishlistToggle();
  initCrossSell();
  initSliderObserver();
  initSmartDescriptionParser();
}

/**
 * 1. Sticky Add to Cart Synchronization
 */
function initStickyAtc() {
  const stickyAtc = document.querySelector('.exp-sticky-atc');
  const stickyBtn = document.querySelector('.exp-sticky-atc__btn');
  const mainBuyBtn = document.querySelector('.product-form__submit');

  if (!stickyAtc || !stickyBtn) return;

  // On click of sticky CTA, click the native product submit button
  stickyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const currentMainBtn = document.querySelector('.product-form__submit');
    if (currentMainBtn) {
      currentMainBtn.click();
    } else {
      const form = document.querySelector('product-form form');
      if (form) form.requestSubmit();
    }
  });

  // Desktop scroll observer: show sticky bar when main CTA scrolls out of view
  if (window.innerWidth >= 750 && mainBuyBtn) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          stickyAtc.classList.add('is-visible');
        } else {
          stickyAtc.classList.remove('is-visible');
        }
      });
    }, { threshold: 0.1 });

    observer.observe(mainBuyBtn);
  }
}

/**
 * 2. Color Swatches Sync
 */
function initColorSwatchesSync() {
  const colorRadios = document.querySelectorAll('.exp-swatch-item input[type="radio"]');
  const colorSelectedName = document.querySelector('.exp-color-selected-name');
  const stickyVariantText = document.querySelector('.exp-sticky-atc__variant');

  colorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const colorVal = e.target.value;
      if (colorSelectedName) {
        colorSelectedName.textContent = colorVal.toUpperCase();
      }
      updateStickyVariantLabel();
    });
  });
}

/**
 * 3. Size Cards Sync
 */
function initSizeCardsSync() {
  const sizeRadios = document.querySelectorAll('.exp-size-card input[type="radio"]');
  const sizeSelectedName = document.querySelector('.exp-size-selected-name');

  sizeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const sizeVal = e.target.value;
      if (sizeSelectedName) {
        sizeSelectedName.textContent = sizeVal.toUpperCase();
      }
      updateStickyVariantLabel();
    });
  });
}

function updateStickyVariantLabel() {
  const stickyVariantText = document.querySelector('.exp-sticky-atc__variant');
  const activeColor = document.querySelector('.exp-swatch-item input[type="radio"]:checked')?.value || 'Spice';
  const activeSize = document.querySelector('.exp-size-card input[type="radio"]:checked')?.value || '28cm';

  if (stickyVariantText) {
    stickyVariantText.textContent = `${activeColor} • ${activeSize}`;
  }
}

/**
 * 4. 360 Interactive Viewer Modal
 */
function init360Modal() {
  const btn360 = document.querySelectorAll('.exp-btn-360');
  const modal = document.querySelector('.exp-360-modal');
  const closeBtn = document.querySelector('.exp-360-modal__close');
  const viewerArea = document.querySelector('.exp-360-viewer-area');
  const viewerImg = document.querySelector('.exp-360-viewer-area img');

  if (!modal) return;

  btn360.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeModal = () => {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // Interactive 360 drag rotation
  if (viewerArea && viewerImg) {
    let isDragging = false;
    let startX = 0;
    let currentRotation = 0;

    const onStart = (clientX) => {
      isDragging = true;
      startX = clientX;
    };

    const onMove = (clientX) => {
      if (!isDragging) return;
      const deltaX = clientX - startX;
      currentRotation += deltaX * 0.4;
      startX = clientX;
      viewerImg.style.transform = `rotateY(${currentRotation}deg)`;
    };

    const onEnd = () => {
      isDragging = false;
    };

    viewerArea.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    viewerArea.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', onEnd);
  }
}

/**
 * 5. Wishlist Heart Toggle
 */
function initWishlistToggle() {
  const wishlistBtn = document.querySelector('.exp-mobile-header__wishlist');
  if (!wishlistBtn) return;

  const productId = wishlistBtn.dataset.productId || 'always-pan';
  const isSaved = localStorage.getItem(`exp_wishlist_${productId}`) === 'true';

  if (isSaved) {
    wishlistBtn.classList.add('is-active');
  }

  wishlistBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const active = wishlistBtn.classList.toggle('is-active');
    localStorage.setItem(`exp_wishlist_${productId}`, active);
  });
}

/**
 * 6. Cross-sell "+ Tambah" Quick-Add
 */
function initCrossSell() {
  const crossSellBtn = document.querySelector('.exp-cross-sell-btn');
  if (!crossSellBtn) return;

  crossSellBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const variantId = crossSellBtn.dataset.variantId;
    if (!variantId) {
      crossSellBtn.textContent = '✓ Ditambahkan';
      crossSellBtn.classList.add('is-added');
      return;
    }

    try {
      crossSellBtn.disabled = true;
      crossSellBtn.textContent = 'Menambahkan...';

      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ id: variantId, quantity: 1 })
      });

      if (res.ok) {
        crossSellBtn.textContent = '✓ Ditambahkan';
        crossSellBtn.classList.add('is-added');
        // Publish cart update event for Dawn
        if (window.publish && window.PUB_SUB_EVENTS) {
          window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'exp-cross-sell' });
        }
      } else {
        crossSellBtn.textContent = '+ Tambah';
        crossSellBtn.disabled = false;
      }
    } catch (err) {
      crossSellBtn.textContent = '✓ Ditambahkan';
      crossSellBtn.classList.add('is-added');
    }
  });
}

/**
 * 7. Slider Dot & Counter Observer
 */
function initSliderObserver() {
  const slider = document.querySelector('.product__media-list.slider--mobile');
  const dots = document.querySelectorAll('.exp-slider-dot');
  const counterCurrent = document.querySelector('.exp-slider-counter--current');

  if (!slider) return;

  const slides = slider.querySelectorAll('.product__media-item');
  if (slides.length <= 1) return;

  slider.addEventListener('scroll', () => {
    const scrollLeft = slider.scrollLeft;
    const slideWidth = slides[0].offsetWidth || 1;
    const activeIndex = Math.round(scrollLeft / slideWidth);

    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === activeIndex);
    });

    if (counterCurrent) {
      counterCurrent.textContent = (activeIndex + 1);
    }
  }, { passive: true });
}


/**
 * 8. Smart Description Parser
 * Memproses product.description agar tidak memuat semua deskripsi ke satu tab:
 * - Paragraf cerita, keunggulan, & intro masuk ke Tab 1 (Deskripsi & Keunggulan)
 * - Spesifikasi, ukuran, berat, bahan, & pack size masuk ke Tab 2 (Spesifikasi & Material Non-Toxic)
 * - Kebijakan, jaminan, & garansi masuk ke Tab 3 (Garansi Uji Coba 100 Hari Bebas Risiko)
 */
function initSmartDescriptionParser() {
  const container = document.querySelector('.exp-smart-description');
  if (!container) return;

  const rawDescription = container.getAttribute('data-raw-description');
  if (!rawDescription) return;

  const tab1Body = container.querySelector('.exp-accordion-body[data-tab-type="desc"]');
  const tab2Body = container.querySelector('.exp-accordion-body[data-tab-type="specs"]');
  const tab3Body = container.querySelector('.exp-accordion-body[data-tab-type="warranty"]');

  if (!tab1Body || !tab2Body) return;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawDescription, 'text/html');

    // Filter out demo disclaimer
    const allP = doc.querySelectorAll('p');
    allP.forEach(p => {
      if (p.textContent.toLowerCase().includes('this is a demonstration store')) {
        p.remove();
      }
    });

    const headings = doc.querySelectorAll('h2, h3, h4, h5, h6');
    if (headings.length > 0) {
      const tab1Fragment = document.createDocumentFragment();
      const tab2Fragment = document.createDocumentFragment();
      const tab3Fragment = document.createDocumentFragment();

      let targetFrag = tab1Fragment;

      Array.from(doc.body.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && /^H[2-6]$/.test(node.tagName)) {
          const title = node.textContent.toLowerCase();
          if (/garansi|warranty|return|jaminan|kebijakan|refund|bebas risiko/.test(title)) {
            targetFrag = tab3Fragment;
          } else if (/spesifikasi|material|specs|bahan|ukuran|dimensi|berat|weight|ingredients|komposisi|size/.test(title)) {
            targetFrag = tab2Fragment;
          } else {
            targetFrag = tab1Fragment;
          }
        } else {
          targetFrag.appendChild(node.cloneNode(true));
        }
      });

      if (tab1Fragment.childNodes.length > 0) {
        tab1Body.innerHTML = '';
        tab1Body.appendChild(tab1Fragment);
      }
      if (tab2Fragment.childNodes.length > 0) {
        tab2Body.innerHTML = '';
        tab2Body.appendChild(tab2Fragment);
      }
      if (tab3Fragment.childNodes.length > 0 && tab3Body) {
        tab3Body.innerHTML = '';
        tab3Body.appendChild(tab3Fragment);
      }
    } else {
      const specLabelRegex = /(spesifikasi|material|specs|dimensi|ukuran|berat|kapasitas|diameter|bahan|komposisi|nutrition|netto|net wt|volume):/i;
      const specUnitRegex = /\d+(\.\d+)?\s*(oz|ml|gram|g|kg|cm|mm|inch|liter|l|pcs)\b/i;
      const specKeywords = /\b(pack size|bottle pack|net weight|made in|non-toxic|ptfe|pfoa|die-cast|diameter)\b/i;
      const warrantyRegex = /\b(garansi|warranty|return|refund|jaminan|100 hari|kebijakan|bebas risiko)\b/i;

      const tab1Frag = document.createDocumentFragment();
      const tab2Frag = document.createDocumentFragment();
      const tab3Frag = document.createDocumentFragment();

      Array.from(doc.body.children).forEach(el => {
        const text = el.textContent.trim();
        if (!text) return;

        if (warrantyRegex.test(text)) {
          tab3Frag.appendChild(el.cloneNode(true));
        } else if (
          el.tagName === 'UL' ||
          el.tagName === 'OL' ||
          el.tagName === 'TABLE' ||
          specLabelRegex.test(text) ||
          (text.length < 120 && specUnitRegex.test(text)) ||
          (text.length < 100 && specKeywords.test(text))
        ) {
          tab2Frag.appendChild(el.cloneNode(true));
        } else {
          tab1Frag.appendChild(el.cloneNode(true));
        }
      });

      if (tab1Frag.childNodes.length > 0) {
        tab1Body.innerHTML = '';
        tab1Body.appendChild(tab1Frag);
      }
      if (tab2Frag.childNodes.length > 0) {
        tab2Body.innerHTML = '';
        tab2Body.appendChild(tab2Frag);
      }
      if (tab3Frag.childNodes.length > 0 && tab3Body) {
        tab3Body.innerHTML = '';
        tab3Body.appendChild(tab3Frag);
      }
    }
  } catch (e) {
    console.error('Error in initSmartDescriptionParser:', e);
  }
}
